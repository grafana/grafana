import { map as _map } from 'lodash';
import { Observable, of } from 'rxjs';
import { catchError, map, mapTo } from 'rxjs/operators';
import { getBackendSrv, DataSourceWithBackend, frameToMetricFindValue } from '@grafana/runtime';
import {
  AnnotationEvent,
  DataQueryRequest,
  DataSourceInstanceSettings,
  ScopedVars,
  DataQueryResponse,
  MetricFindValue,
} from '@grafana/data';
import ResponseParser from './response_parser';
import { MySqlQueryForInterpolation, MySqlOptions, MySqlQuery } from './types';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { getSearchFilterScopedVar } from '../../../features/variables/utils';
import { quoteLiteral, buildQuery } from './sql';

export class MySqlDatasource extends DataSourceWithBackend<MySqlQuery, MySqlOptions> {
  id: any;
  name: any;
  responseParser: ResponseParser;
  queryModel: MySqlQuery;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<MySqlOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser();
    const settingsData = instanceSettings.jsonData || ({} as MySqlOptions);
    this.interval = settingsData.timeInterval || '1m';
  }

  interpolateVariable = (value: string | string[] | number, variable: any) => {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return quoteLiteral(value);
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _map(value, (v: any) => {
      return quoteLiteral(v);
    });
    return quotedValues.join(',');
  };

  interpolateVariablesInQueries(
    queries: MySqlQueryForInterpolation[],
    scopedVars: ScopedVars
  ): MySqlQueryForInterpolation[] {
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

  filterQuery(query: MySqlQuery): boolean {
    return !query.hide;
  }

  applyTemplateVariables(target: MySqlQuery, scopedVars: ScopedVars): Record<string, any> {
    // new query with no table set yet
    let rawSql = target.rawSql || '';
    if (rawSql.length === 0) {
      if ('table' in target) {
        rawSql = buildQuery(target);
      }
    } else if (this.interpolateVariable != null) {
      rawSql = this.templateSrv.replace(rawSql, scopedVars, interpolateQueryStr);
    }

    return {
      refId: target.refId,
      datasourceId: this.id,
      rawSql: rawSql,
      format: target.format,
    };
  }

  query(request: DataQueryRequest<MySqlQuery>): Observable<DataQueryResponse> {
    return super.query(request);
  }

  annotationQuery(options: any): Promise<AnnotationEvent[]> {
    if (!options.annotation.rawQuery) {
      throw new Error('Query missing in annotation definition');
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

  async metricFindQuery(query: string, optionalOptions: any): Promise<MetricFindValue[]> {
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

    const rsp = await super
      .query({
        ...optionalOptions, // includes 'range'
        targets: [interpolatedQuery],
      } as DataQueryRequest)
      .toPromise();
    if (rsp.data?.length) {
      return frameToMetricFindValue(rsp.data[0]);
    }
    return [];
  }

  async testDatasource() {
    await getBackendSrv()
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

    if ((target.rawSql || '').length > 0) {
      rawSql = target.rawSql;
    } else {
      rawSql = buildQuery(target);
    }

    rawSql = rawSql.replace('$__', '');

    return this.templateSrv.variableExists(rawSql);
  }
}

const interpolateQueryStr = (
  value: string,
  variable: { multi: any; includeAll: any },
  defaultFormatFn: any
): string => {
  // if no multi or include all do not regexEscape
  if (!variable.multi && !variable.includeAll) {
    return quoteLiteral(value);
  }

  if (typeof value === 'string') {
    return quoteLiteral(value);
  }

  const escapedValues = _map(value, quoteLiteral);
  return escapedValues.join(',');
};
