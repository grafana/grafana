import { map as _map } from 'lodash';
import { Observable, of } from 'rxjs';
import { catchError, map, mapTo } from 'rxjs/operators';
import { getBackendSrv, DataSourceWithBackend, frameToMetricFindValue } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  ScopedVars,
  DataQueryResponse,
  MetricFindValue,
} from '@grafana/data';
import MysqlQuery from 'app/plugins/datasource/mysql/mysql_query';
import ResponseParser from './response_parser';
import { MysqlQueryForInterpolation, MySQLOptions, MySQLQuery } from './types';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';

export class MysqlDatasource extends DataSourceWithBackend<MySQLQuery, MySQLOptions> {
  id: any;
  name: any;
  responseParser: ResponseParser;
  queryModel: MysqlQuery;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<MySQLOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser();
    this.queryModel = new MysqlQuery({});
    const settingsData = instanceSettings.jsonData || ({} as MySQLOptions);
    this.interval = settingsData.timeInterval || '1m';
  }

  interpolateVariable = (value: string | string[] | number, variable: any) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        const result = this.queryModel.quoteLiteral(value);
        return result;
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _map(value, (v: any) => {
      return this.queryModel.quoteLiteral(v);
    });
    return quotedValues.join(',');
  };

  interpolateVariablesInQueries(
    queries: MysqlQueryForInterpolation[],
    scopedVars: ScopedVars
  ): MysqlQueryForInterpolation[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map((query) => {
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

  filterQuery(query: MySQLQuery): boolean {
    if (query.hide) {
      return false;
    }
    return true;
  }

  applyTemplateVariables(target: MySQLQuery, scopedVars: ScopedVars): Record<string, any> {
    const queryModel = new MysqlQuery(target, this.templateSrv, scopedVars);
    return {
      refId: target.refId,
      datasourceId: this.id,
      rawSql: queryModel.render(this.interpolateVariable as any),
      format: target.format,
    };
  }

  query(request: DataQueryRequest<MySQLQuery>): Observable<DataQueryResponse> {
    return super.query(request);
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

  metricFindQuery(query: string, optionalOptions: any): Promise<MetricFindValue[]> {
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

    return super
      .query({
        ...optionalOptions, // includes 'range'
        targets: [interpolatedQuery],
      } as DataQueryRequest)
      .toPromise()
      .then((rsp) => {
        if (rsp.data?.length) {
          return frameToMetricFindValue(rsp.data[0]);
        }
        return [];
      });
  }

  testDatasource() {
    return getBackendSrv()
      .fetch({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: '5m',
          to: 'now',
          queries: [
            {
              refId: 'A',
              intervalMs: 1,
              maxDataPoints: 1,
              datasourceId: this.id,
              rawSql: 'SELECT 1',
              format: 'table',
            },
          ],
        },
      })
      .pipe(
        mapTo({ status: 'success', message: 'Database Connection OK' }),
        catchError((err) => {
          console.error(err);
          if (err.data && err.data.message) {
            return of({ status: 'error', message: err.data.message });
          } else {
            return of({ status: 'error', message: err.status });
          }
        })
      )
      .toPromise();
  }

  targetContainsTemplate(target: any) {
    let rawSql = '';

    if (target.rawQuery) {
      rawSql = target.rawSql;
    } else {
      const query = new MysqlQuery(target);
      rawSql = query.buildQuery();
    }

    rawSql = rawSql.replace('$__', '');

    return this.templateSrv.variableExists(rawSql);
  }
}
