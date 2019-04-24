import _ from 'lodash';
import ResponseParser from './response_parser';
import PostgresQuery from 'app/plugins/datasource/postgres/postgres_query';

export class PostgresDatasource {
  id: any;
  name: any;
  jsonData: any;
  responseParser: ResponseParser;
  queryModel: PostgresQuery;
  interval: string;

  /** @ngInject */
  constructor(instanceSettings, private backendSrv, private $q, private templateSrv, private timeSrv) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
    this.jsonData = instanceSettings.jsonData;
    this.responseParser = new ResponseParser(this.$q);
    this.queryModel = new PostgresQuery({});
    this.interval = (instanceSettings.jsonData || {}).timeInterval || '1m';
  }

  interpolateVariable = (value, variable) => {
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

  query(options) {
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

  annotationQuery(options) {
    if (!options.annotation.rawQuery) {
      return this.$q.reject({
        message: 'Query missing in annotation definition',
      });
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
      .then(data => this.responseParser.transformAnnotationResponse(options, data));
  }

  metricFindQuery(query, optionalOptions) {
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
      .then(data => this.responseParser.parseMetricFindQueryResult(refId, data));
  }

  getVersion() {
    return this.metricFindQuery("SELECT current_setting('server_version_num')::int/100", {});
  }

  getTimescaleDBVersion() {
    return this.metricFindQuery("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'", {});
  }

  testDatasource() {
    return this.metricFindQuery('SELECT 1', {})
      .then(res => {
        return { status: 'success', message: 'Database Connection OK' };
      })
      .catch(err => {
        console.log(err);
        if (err.data && err.data.message) {
          return { status: 'error', message: err.data.message };
        } else {
          return { status: 'error', message: err.status };
        }
      });
  }
}
