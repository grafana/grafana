import _ from 'lodash';
import ResponseParser from './response_parser';
import { BackendSrv } from 'app/core/services/backend_srv';
import { IQService } from 'angular';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { TimeSrv } from 'app/features/dashboard/services/TimeSrv';
//Types
import { MssqlQueryForInterpolation } from './types';

export class MssqlDatasource {
  id: any;
  name: any;
  responseParser: ResponseParser;
  interval: string;

  /** @ngInject */
  constructor(
    instanceSettings: any,
    private backendSrv: BackendSrv,
    private $q: IQService,
    private templateSrv: TemplateSrv,
    private timeSrv: TimeSrv
  ) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.responseParser = new ResponseParser(this.$q);
    this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
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

    const quotedValues = _.map(value, val => {
      if (typeof value === 'number') {
        return value;
      }

      return "'" + val.replace(/'/g, `''`) + "'";
    });
    return quotedValues.join(',');
  }

  interpolateVariablesInQueries(queries: MssqlQueryForInterpolation[]): MssqlQueryForInterpolation[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          rawSql: this.templateSrv.replace(query.rawSql, {}, this.interpolateVariable),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  query(options: any) {
    const queries = _.filter(options.targets, item => {
      return item.hide !== true;
    }).map(item => {
      return {
        refId: item.refId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        rawSql: this.templateSrv.replace(item.rawSql, options.scopedVars, this.interpolateVariable),
        format: item.format,
      };
    });

    if (queries.length === 0) {
      return this.$q.when({ data: [] });
    }

    return this.backendSrv
      .datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries: queries,
        },
      })
      .then(this.responseParser.processQueryResult);
  }

  annotationQuery(options: any) {
    if (!options.annotation.rawQuery) {
      return this.$q.reject({ message: 'Query missing in annotation definition' });
    }

    const query = {
      refId: options.annotation.name,
      datasourceId: this.id,
      rawSql: this.templateSrv.replace(options.annotation.rawQuery, options.scopedVars, this.interpolateVariable),
      format: 'table',
    };

    return this.backendSrv
      .datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: {
          from: options.range.from.valueOf().toString(),
          to: options.range.to.valueOf().toString(),
          queries: [query],
        },
      })
      .then((data: any) => this.responseParser.transformAnnotationResponse(options, data));
  }

  metricFindQuery(query: string, optionalOptions: { variable: { name: string } }) {
    let refId = 'tempvar';
    if (optionalOptions && optionalOptions.variable && optionalOptions.variable.name) {
      refId = optionalOptions.variable.name;
    }

    const interpolatedQuery = {
      refId: refId,
      datasourceId: this.id,
      rawSql: this.templateSrv.replace(query, {}, this.interpolateVariable),
      format: 'table',
    };

    const range = this.timeSrv.timeRange();
    const data = {
      queries: [interpolatedQuery],
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
    };

    return this.backendSrv
      .datasourceRequest({
        url: '/api/tsdb/query',
        method: 'POST',
        data: data,
      })
      .then((data: any) => this.responseParser.parseMetricFindQueryResult(refId, data));
  }

  testDatasource() {
    return this.backendSrv
      .datasourceRequest({
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
      .then((res: any) => {
        return { status: 'success', message: 'Database Connection OK' };
      })
      .catch((err: any) => {
        console.log(err);
        if (err.data && err.data.message) {
          return { status: 'error', message: err.data.message };
        } else {
          return { status: 'error', message: err.status };
        }
      });
  }

  targetContainsTemplate(target: any) {
    const rawSql = target.rawSql.replace('$__', '');
    return this.templateSrv.variableExists(rawSql);
  }
}
