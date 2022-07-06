import { lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import {
  AnnotationEvent,
  DataFrame,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceRef,
  MetricFindValue,
  ScopedVars,
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

import { VariableWithMultiSupport } from '../../../variables/types';
import { getSearchFilterScopedVar } from '../../../variables/utils';
import {
  DB,
  SQLQuery,
  SQLOptions,
  SqlQueryForInterpolation,
  ResponseParser,
  SqlQueryModel,
  QueryFormat,
} from '../types';

export abstract class SqlDatasource extends DataSourceWithBackend<SQLQuery, SQLOptions> {
  id: number;
  name: string;
  interval: string;
  db: DB;

  constructor(
    instanceSettings: DataSourceInstanceSettings<SQLOptions>,
    protected readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    const settingsData = instanceSettings.jsonData || {};
    this.interval = settingsData.timeInterval || '1m';
    this.db = this.getDB();
  }

  abstract getDB(dsID?: number): DB;

  abstract getQueryModel(target?: SQLQuery, templateSrv?: TemplateSrv, scopedVars?: ScopedVars): SqlQueryModel;

  abstract getResponseParser(): ResponseParser;

  interpolateVariable = (value: string | string[] | number, variable: VariableWithMultiSupport) => {
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

    if (Array.isArray(value)) {
      const quotedValues = value.map((v) => this.getQueryModel().quoteLiteral(v));
      return quotedValues.join(',');
    }

    return value;
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

  applyTemplateVariables(
    target: SQLQuery,
    scopedVars: ScopedVars
  ): Record<string, string | DataSourceRef | SQLQuery['format']> {
    const queryModel = this.getQueryModel(target, this.templateSrv, scopedVars);
    const rawSql = this.clean(queryModel.interpolate());
    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql,
      format: target.format,
    };
  }

  clean(value: string) {
    return value.replace(/''/g, "'");
  }

  // eslint-ignore @typescript-eslint/no-explicit-any
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
    const rawSql = this.templateSrv.replace(
      query,
      getSearchFilterScopedVar({ query, wildcardChar: '%', options: optionalOptions }),
      this.interpolateVariable
    );

    const interpolatedQuery = {
      datasourceId: this.id,
      datasource: this.getRef(),
      rawSql,
      format: QueryFormat.Table,
    };

    const response = await this.runQuery(interpolatedQuery, optionalOptions);
    return this.getResponseParser().transformMetricFindResponse(response);
  }

  async runSql<T = any>(query: string) {
    const frame = await this.runQuery({ rawSql: query, format: QueryFormat.Table }, {});
    return new DataFrameView<T>(frame);
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
          map(() => ({ status: 'success', message: 'Database Connection OK' })),
          catchError((err) => {
            return of(toTestingStatus(err));
          })
        )
    );
  }

  targetContainsTemplate(target: any) {
    return this.templateSrv.containsTemplate(target.rawSql);
  }
}
