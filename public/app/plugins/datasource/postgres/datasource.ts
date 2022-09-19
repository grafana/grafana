import { map as _map } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { AnnotationEvent, DataSourceInstanceSettings, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';
import { BackendDataSourceResponse, DataSourceWithBackend, FetchResponse, getBackendSrv } from '@grafana/runtime';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import PostgresQueryModel from 'app/plugins/datasource/postgres/postgres_query_model';

import { getSearchFilterScopedVar } from '../../../features/variables/utils';

import ResponseParser from './response_parser';
import { PostgresOptions, PostgresQuery, PostgresQueryForInterpolation } from './types';

export class PostgresDatasource extends DataSourceWithBackend<PostgresQuery, PostgresOptions> {
  id: any;
  name: any;
  jsonData: any;
  responseParser: ResponseParser;
  queryModel: PostgresQueryModel;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PostgresOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.jsonData = instanceSettings.jsonData;
    this.responseParser = new ResponseParser();
    this.queryModel = new PostgresQueryModel({});
    const settingsData = instanceSettings.jsonData || ({} as PostgresOptions);
    this.interval = settingsData.timeInterval || '1m';
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

    const quotedValues = _map(value, (v) => {
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

  filterQuery(query: PostgresQuery): boolean {
    return !query.hide;
  }

  applyTemplateVariables(target: PostgresQuery, scopedVars: ScopedVars): Record<string, any> {
    const queryModel = new PostgresQueryModel(target, this.templateSrv, scopedVars);
    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql: queryModel.render(this.interpolateVariable),
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
              await this.responseParser.transformAnnotationResponse(options, res.data)
          )
        )
    );
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
      datasource: this.getRef(),
      rawSql,
      format: 'table',
    };

    const range = optionalOptions?.range as TimeRange;

    return lastValueFrom(
      getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: '/api/ds/query',
          method: 'POST',
          data: {
            from: range?.from?.valueOf()?.toString(),
            to: range?.to?.valueOf()?.toString(),
            queries: [interpolatedQuery],
          },
          requestId: refId,
        })
        .pipe(
          map((rsp) => {
            return this.responseParser.transformMetricFindResponse(rsp);
          }),
          catchError((err) => {
            return of([]);
          })
        )
    );
  }

  private _metaRequest(rawSql: string) {
    const refId = 'meta';
    const query = {
      refId: refId,
      datasource: this.getRef(),
      rawSql,
      format: 'table',
    };
    return getBackendSrv().fetch<BackendDataSourceResponse>({
      url: '/api/ds/query',
      method: 'POST',
      data: {
        queries: [query],
      },
      requestId: refId,
    });
  }

  async getVersion(): Promise<string> {
    const value = await lastValueFrom(this._metaRequest("SELECT current_setting('server_version_num')::int/100"));
    const results = value.data.results['meta'];
    if (results.frames) {
      // This returns number
      return (results.frames[0].data?.values[0] as number[])[0].toString();
    }
    return '';
  }

  async getTimescaleDBVersion(): Promise<string[] | undefined> {
    const value = await lastValueFrom(
      this._metaRequest("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'")
    );
    const results = value.data.results['meta'];
    if (results.frames) {
      return results.frames[0].data?.values[0][0] as string[];
    }
    return undefined;
  }

  testDatasource(): Promise<any> {
    return lastValueFrom(this._metaRequest('SELECT 1'))
      .then(() => {
        return { status: 'success', message: 'Database Connection OK' };
      })
      .catch((err: any) => {
        return toTestingStatus(err);
      });
  }

  targetContainsTemplate(target: any) {
    let rawSql = '';

    if (target.rawQuery) {
      rawSql = target.rawSql;
    } else {
      const query = new PostgresQueryModel(target);
      rawSql = query.buildQuery();
    }

    rawSql = rawSql.replace('$__', '');

    return this.templateSrv.containsTemplate(rawSql);
  }
}
