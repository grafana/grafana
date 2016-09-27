///<reference path="../../../../headers/common.d.ts" />

import _ from 'lodash';

class TestDataDatasource {

  /** @ngInject */
  constructor(private backendSrv, private $q) {}

  query(options) {
    var queries = _.filter(options.targets, item => {
      return item.hide !== true;
    });

    if (queries.length === 0) {
      return this.$q.when({data: []});
    }

    return this.backendSrv.get('/api/metrics/test', {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      scenario: options.targets[0].scenario,
      interval: options.intervalMs,
      maxDataPoints: options.maxDataPoints,
    }).then(res => {
      res.data = res.data.map(item => {
        return {target: item.name, datapoints: item.points};
      });

      return res;
    });
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

export {TestDataDatasource};
