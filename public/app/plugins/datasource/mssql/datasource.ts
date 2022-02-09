import { map as _map } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map, mapTo } from 'rxjs/operators';
import { BackendDataSourceResponse, DataSourceWithBackend, FetchResponse, getBackendSrv } from '@grafana/runtime';
import { AnnotationEvent, DataSourceInstanceSettings, MetricFindValue, ScopedVars } from '@grafana/data';

import ResponseParser from './response_parser';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { MssqlOptions, MssqlQuery, MssqlQueryForInterpolation } from './types';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { toTestingStatus } from '@grafana/runtime/src/utils/queryResponse';

export class MssqlDatasource extends DataSourceWithBackend<MssqlQuery, MssqlOptions> {
  id: any;
  name: any;
  responseParser: ResponseParser;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<MssqlOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser();
    const settingsData = instanceSettings.jsonData || ({} as MssqlOptions);
    this.interval = settingsData.timeInterval || '1m';
  }

  interpolateVariable(value: any, variable: any) {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return "'" + value.replace(/'/g, `''`) + "'";
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _map(value, (val) => {
      if (typeof value === 'number') {
        return value;
      }

      return "'" + val.replace(/'/g, `''`) + "'";
    });
    return quotedValues.join(',');
  }

  interpolateVariablesInQueries(
    queries: MssqlQueryForInterpolation[],
    scopedVars: ScopedVars
  ): MssqlQueryForInterpolation[] {
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

  applyTemplateVariables(target: MssqlQuery, scopedVars: ScopedVars): Record<string, any> {
    return {
      refId: target.refId,
      datasource: this.getRef(),
      rawSql: this.templateSrv.replace(target.rawSql, scopedVars, this.interpolateVariable),
      format: target.format,
    };
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    if (!options.annotation.rawQuery) {
      return Promise.reject({ message: 'Query missing in annotation definition' });
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

  filterQuery(query: MssqlQuery): boolean {
    return !query.hide;
  }

  metricFindQuery(query: string, optionalOptions: any): Promise<MetricFindValue[]> {
    let refId = 'tempvar';
    if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
      refId = optionalOptions.variable.name;
    }

    const range = this.timeSrv.timeRange();

    const interpolatedQuery = {
      refId: refId,
      datasource: this.getRef(),
      rawSql: this.templateSrv.replace(query, {}, this.interpolateVariable),
      format: 'table',
    };

    return lastValueFrom(
      getBackendSrv()
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
          }),
          catchError((err) => {
            return of([]);
          })
        )
    );
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

  targetContainsTemplate(query: MssqlQuery): boolean {
    const rawSql = query.rawSql.replace('$__', '');
    return this.templateSrv.variableExists(rawSql);
  }
}
