import { map as _map } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map, mapTo } from 'rxjs/operators';

import {
  AnnotationEvent,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  MetricFindValue,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import {
  BackendDataSourceResponse,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  TemplateSrv,
} from '@grafana/runtime';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';
import MySQLQueryModel from 'app/plugins/datasource/mysql/MySqlQueryModel';

import { getSearchFilterScopedVar } from '../../../../features/variables/utils';
import {
  DB,
  SQLQuery,
  TableSchema,
  ValidationResults,
  SQLOptions,
  SqlQueryForInterpolation,
  ResponseParser,
  SqlQueryModel,
  QueryFormat,
} from '../types';

export abstract class SqlDatasource extends DataSourceWithBackend<SQLQuery, SQLOptions> {
  id: any;
  name: any;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<SQLOptions>,
    protected readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    const settingsData = instanceSettings.jsonData || ({} as SQLOptions);
    this.interval = settingsData.timeInterval || '1m';
  }

  abstract getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): SqlQueryModel;

  abstract getResponseParser(): ResponseParser;

  interpolateVariable = (value: string | string[] | number, variable: any) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        const result = this.getQueryModel().quoteLiteral(value);
        return result;
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _map(value, (v: any) => {
      return this.getQueryModel().quoteLiteral(v);
    });
    return quotedValues.join(',');
  };

  interpolateVariablesInQueries(
    queries: SqlQueryForInterpolation[],
    scopedVars: ScopedVars
  ): SqlQueryForInterpolation[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map((query) => {
        const expandedQuery = {
          ...query,
          datasource: this.getRef(),
          rawSql: this.templateSrv.replace(query.rawSql, scopedVars, this.interpolateVariable),
          rawQuery: true,
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  filterQuery(query: SQLQuery): boolean {
    return !query.hide;
  }

  applyTemplateVariables(target: SQLQuery, scopedVars: ScopedVars): Record<string, any> {
    const queryModel = new MySQLQueryModel(target, this.templateSrv, scopedVars);
    return {
      refId: target.refId,
      datasource: this.getRef(),
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
      datasource: this.getRef(),
      rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
      format: 'table',
    };

    return lastValueFrom(
      getBackendSrv()
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
              await this.getResponseParser().transformAnnotationResponse(options, res.data)
          )
        )
    );
  }

  async metricFindQuery(query: string, optionalOptions: any): Promise<MetricFindValue[]> {
    // let refId = 'tempvar';
    // if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
    //   refId = optionalOptions.variable.name;
    // }

    const rawSql = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '%', options: optionalOptions }),
      this.interpolateVariable
    );

    const interpolatedQuery = {
      // refId: refId,
      datasourceId: this.id,
      datasource: this.getRef(),
      rawSql,
      format: QueryFormat.Table,
    };

    const response = await this.runQuery(interpolatedQuery, optionalOptions);
    return this.getResponseParser().transformMetricFindResponse(response);
  }

  private runQuery(request: Partial<SQLQuery>, options?: any): Promise<DataFrame> {
    return new Promise((resolve) => {
      const req = {
        targets: [{ ...request, refId: String(Math.random()) }],
        range: options?.range,
      } as DataQueryRequest<SQLQuery>;
      this.query(req).subscribe((res: DataQueryResponse) => {
        resolve(res.data[0] || { fields: [] });
      });
    });
  }

  testDatasource(): Promise<any> {
    return lastValueFrom(
      getBackendSrv()
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
                datasource: this.getRef(),
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
    );
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

    return this.templateSrv.containsTemplate(rawSql);
  }

  async fetchTables(dataset?: string): Promise<string[]> {
    return [];
  }

  async fetchDatasets(): Promise<string[]> {
    return [];
  }

  getDB(dsID?: string): DB {
    const empty: string[] = [];
    return {
      init: () => {
        return Promise.resolve();
      },
      datasets: () => {
        return Promise.resolve(empty);
      },
      tables: (dataset?: string) => {
        return Promise.resolve(empty);
      },
      tableSchema: (query: SQLQuery | string) => {
        const schema = {} as TableSchema;
        return Promise.resolve(schema);
      },
      fields: (query: SQLQuery) => {
        // handle "path" here: database.table
        return Promise.resolve(empty);
      },
      validateQuery: (query: SQLQuery, range?: TimeRange) => {
        const results = {} as ValidationResults;
        return Promise.resolve(results);
      },
      dsID: () => {
        return this.id;
      },
      dispose: (dsID?: string) => {},
      lookup: async (path?: string) => {
        if (!path) {
          const datasets = await this.fetchDatasets();
          return datasets.map((d) => ({ name: d, completion: `${d}.` }));
        } else {
          const parts = path.split('.').filter((s: string) => s);
          if (parts.length > 2) {
            return [];
          }
          if (parts.length === 1) {
            const tables = await this.fetchTables(path[0]);
            return tables.map((t) => ({ name: t, completion: `${t}\`` }));
          } else {
            return [];
          }
        }
      },
    };
  }
}
