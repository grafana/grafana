import { map as _map } from 'lodash';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { getBackendSrv, DataSourceWithBackend, frameToMetricFindValue } from '@grafana/runtime';
import {
  DataQueryRequest,
  DataSourceInstanceSettings,
  ScopedVars,
  DataQueryResponse,
  MetricFindValue,
} from '@grafana/data';
import ResponseParser from './response_parser';
import { PostgresMetricFindValue, PostgresQueryForInterpolation, PostgresOptions, PostgresQuery } from './types';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { getSearchFilterScopedVar } from '../../../features/variables/utils';

export class PostgresDatasource extends DataSourceWithBackend<PostgresQuery, PostgresQueryOptions> {
  id: any;
  name: any;
  responseParser: ResponseParser;
  queryModel: PostgresQuery;
  interval: string;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PostgresOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser();
    this.queryModel = new PostgresQuery({});
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

    const quotedValues = _map(value, (v: any) => {
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
          datasource: this.name,
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
    const queryModel = new PostgresQuery(target, this.templateSrv, scopedVars);
    return {
      refId: target.refId,
      datasourceId: this.id,
      rawSql: queryModel.render(this.interpolateVariable as any),
      format: target.format,
    };
  }

  async annotationQuery(options: any) {
    if (!options.annotation.rawQuery) {
      throw new Error('Query missing in annotation definition');
    }

    const query = {
      refId: options.annotation.name,
      datasourceId: this.id,
      rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
      format: 'table',
    };

    await getBackendSrv()
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

  async metricFindQuery(
    query: string,
    optionalOptions: { variable?: any; searchFilter?: string }
  ): Promise<MetricFindValue[]> {
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
    let res: any;
    try {
      res = await this.metricFindQuery('SELECT 1', {});
    } catch (err: any) {
      console.error(err);
      if (err.data && err.data.message) {
        return { status: 'error', message: err.data.message };
      } else {
        return { status: 'error', message: err.status };
      }
    }

    return { status: 'success', message: 'Database Connection OK' };
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
