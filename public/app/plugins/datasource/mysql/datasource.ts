import { map as _map } from 'lodash';
import { catchError, map, mapTo } from 'rxjs/operators';
import { getBackendSrv, DataSourceWithBackend, FetchResponse, BackendDataSourceResponse } from '@grafana/runtime';
import { DataSourceInstanceSettings, ScopedVars, MetricFindValue, AnnotationEvent } from '@grafana/data';
import MySQLQueryModel from 'app/plugins/datasource/mysql/mysql_query_model';
import ResponseParser from './response_parser';
import { MysqlQueryForInterpolation, MySQLOptions, MySQLQuery } from './types';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { of } from 'rxjs';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';

export class MysqlDatasource extends DataSourceWithBackend<MySQLQuery, MySQLOptions> {
  id: any;
  name: any;
  responseParser: ResponseParser;
  queryModel: MySQLQueryModel;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<MySQLOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser();
    this.queryModel = new MySQLQueryModel({});
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
    return !query.hide;
  }

  applyTemplateVariables(target: MySQLQuery, scopedVars: ScopedVars): Record<string, any> {
    const queryModel = new MySQLQueryModel(target, this.templateSrv, scopedVars);
    return {
      refId: target.refId,
      datasourceId: this.id,
      rawSql: queryModel.render(this.interpolateVariable as any),
      format: target.format,
    };
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
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
      .fetch<BackendDataSourceResponse>({
        url: '/api/ds/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries: [query],
        },
        requestId: options.annotation.name,
      })
      .pipe(
        map(
          async (res: FetchResponse<BackendDataSourceResponse>) =>
            await this.responseParser.transformAnnotationResponse(options, res.data)
        )
      )
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

    const range = this.timeSrv.timeRange();

    return getBackendSrv()
      .fetch<BackendDataSourceResponse>({
        url: '/api/ds/query',
        method: 'POST',
        data: {
          from: range.from.valueOf().toString(),
          to: range.to.valueOf().toString(),
          queries: [interpolatedQuery],
        },
        requestId: refId,
      })
      .pipe(
        map((rsp) => {
          return this.responseParser.transformMetricFindResponse(rsp);
        })
      )
      .toPromise();
  }

  testDatasource(): Promise<any> {
    return getBackendSrv()
      .fetch({
        url: '/api/ds/query',
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
          return of(toTestingStatus(err));
        })
      )
      .toPromise();
  }

  targetContainsTemplate(target: any) {
    let rawSql = '';

    if (target.rawQuery) {
      rawSql = target.rawSql;
    } else {
      const query = new MySQLQueryModel(target);
      rawSql = query.buildQuery();
    }

    rawSql = rawSql.replace('$__', '');

    return this.templateSrv.variableExists(rawSql);
  }
}
