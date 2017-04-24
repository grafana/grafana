///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export class MysqlDatasource {
  id: any;
  name: any;

  /** @ngInject **/
  constructor(instanceSettings, private backendSrv, private $q, private templateSrv) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
  }

  interpolateVariable(value) {
    if (typeof value === 'string') {
      return '\"' + value + '\"';
    }

    var quotedValues = _.map(value, function(val) {
      return '\"' + val + '\"';
    });
    return  quotedValues.join(',');
  }

  query(options) {
    var queries = _.filter(options.targets, item => {
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
      return this.$q.when({data: []});
    }

    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries: queries,
      }
    }).then(this.processQueryResult.bind(this));
  }

  processQueryResult(res) {
    var data = [];

    if (!res.data.results) {
      return {data: data};
    }

    for (let key in res.data.results) {
      let queryRes = res.data.results[key];

      if (queryRes.series) {
        for (let series of queryRes.series) {
          data.push({
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          });
        }
      }

      if (queryRes.tables) {
        for (let table of queryRes.tables) {
          table.type = 'table';
          table.refId = queryRes.refId;
          table.meta = queryRes.meta;
          data.push(table);
        }
      }
    }

    return {data: data};
  }
}

