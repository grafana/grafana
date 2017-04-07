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
      };
    });

    if (queries.length === 0) {
      return this.$q.when({data: []});
    }

    return this.backendSrv.post('/api/tsdb/query', {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: queries,
    }).then(res => {
      console.log('mysql response', res);

      var data = [];
      if (res.results) {
        _.forEach(res.results, queryRes => {

          if (queryRes.error) {
            throw {error: queryRes.error, message: queryRes.error};
          }

          for (let series of queryRes.series) {
            data.push({
              target: series.name,
              datapoints: series.points
            });
          }
        });
      }

      return {data: data};
    });
  }
}

