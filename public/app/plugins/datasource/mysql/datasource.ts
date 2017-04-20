///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export class MysqlDatasource {
  id: any;
  name: any;

  /** @ngInject */
  constructor(instanceSettings, private backendSrv, private $q) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
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
        rawSql: item.rawSql,
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
    }).then(res => {
      var data = [];

      if (!res.data.results) {
        return {data: data};
      }

      _.forEach(res.data.results, queryRes => {
        for (let series of queryRes.series) {
          data.push({
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          });
        }
      });

      return {data: data};
    });
  }
}

