///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv, private $q) {}

  query(options) {
    return this.backendSrv.get('/api/tsdb/testdata/random-walk', {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      intervalMs: options.intervalMs,
      maxDataPoints: options.maxDataPoints,
    }).then(res => {
      var data = [];

      if (res.results) {
        _.forEach(res.results, queryRes => {
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

  metricFindQuery(options) {
    return this.$q.when({data: []});
  }

  annotationQuery(options) {
    return this.backendSrv.get('/api/annotations', {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: options.limit,
      type: options.type,
    });
  }

}

export {GrafanaDatasource};
