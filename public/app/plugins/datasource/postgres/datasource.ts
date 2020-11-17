import _ from 'lodash';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import { DataQueryResponse, ScopedVars } from '@grafana/data';

import ResponseParser from './response_parser';
import PostgresQuery from 'app/plugins/datasource/postgres/postgres_query';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
//Types
import { PostgresMetricFindValue, PostgresQueryForInterpolation } from './types';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';

export class PostgresDatasource {
  id: any;
  name: any;
  jsonData: any;
  responseParser: ResponseParser;
  queryModel: PostgresQuery;
  interval: string;

  constructor(
    instanceSettings: { name: any; id?: any; jsonData?: any },
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.jsonData = instanceSettings.jsonData;
    this.responseParser = new ResponseParser();
    this.queryModel = new PostgresQuery({});
    this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
  }

  interpolateVariable = (value: string | string[], variable: { multi: any; includeAll: any }) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return this.queryModel.quoteLiteral(value);
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _.map(value, v => {
      return this.queryModel.quoteLiteral(v);
    });
    return quotedValues.join(',');
  };

  interpolateVariablesInQueries(
    queries: PostgresQueryForInterpolation[],
    scopedVars: ScopedVars
  ): PostgresQueryForInterpolation[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          rawSql: this.templateSrv.replace(query.rawSql, scopedVars, this.interpolateVariable),
          rawQuery: true,
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  query(options: any): Observable<DataQueryResponse> {
    const queries = _.filter(options.targets, target => {
      return target.hide !== true;
    }).map(target => {
      const queryModel = new PostgresQuery(target, this.templateSrv, options.scopedVars);

      return {
        refId: target.refId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        rawSql: queryModel.render(this.interpolateVariable),
        format: target.format,
      };
    });

    if (queries.length === 0) {
      return of({ data: [] });
    }

    return getBackendSrv()
      .fetch({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries: queries,
        },
      })
      .pipe(map(this.responseParser.processQueryResult));
  }

  annotationQuery(options: any) {
    if (!options.annotation.rawQuery) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const query = {
      refId: options.annotation.name,
      datasourceId: this.id,
      rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
      format: 'table',
    };

    return getBackendSrv()
      .fetch({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries: [query],
        },
      })
      .pipe(map((data: any) => this.responseParser.transformAnnotationResponse(options, data)))
      .toPromise();
  }

  metricFindQuery(
    query: string,
    optionalOptions: { variable?: any; searchFilter?: string }
  ): Promise<PostgresMetricFindValue[]> {
    let refId = 'tempvar';
    if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
      refId = optionalOptions.variable.name;
    }

    const rawSql = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '%', options: optionalOptions }),
      this.interpolateVariable
    );

    const interpolatedQuery = {
      refId: refId,
      datasourceId: this.id,
      rawSql,
      format: 'table',
    };

    const range = this.timeSrv.timeRange();
    const data = {
      queries: [interpolatedQuery],
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
    };

    return getBackendSrv()
      .fetch({
        url: '/api/tsdb/query',
        method: 'POST',
        data: data,
      })
      .pipe(map((data: any) => this.responseParser.parseMetricFindQueryResult(refId, data)))
      .toPromise();
  }

  getVersion() {
    return this.metricFindQuery("SELECT current_setting('server_version_num')::int/100", {});
  }

  getTimescaleDBVersion() {
    return this.metricFindQuery("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'", {});
  }

  testDatasource() {
    return this.metricFindQuery('SELECT 1', {})
      .then((res: any) => {
        return { status: 'success', message: 'Database Connection OK' };
      })
      .catch((err: any) => {
        console.error(err);
        if (err.data && err.data.message) {
          return { status: 'error', message: err.data.message };
        } else {
          return { status: 'error', message: err.status };
        }
      });
  }

  targetContainsTemplate(target: any) {
    let rawSql = '';

    if (target.rawQuery) {
      rawSql = target.rawSql;
    } else {
      const query = new PostgresQuery(target);
      rawSql = query.buildQuery();
    }

    rawSql = rawSql.replace('$__', '');

    return this.templateSrv.variableExists(rawSql);
  }
}
