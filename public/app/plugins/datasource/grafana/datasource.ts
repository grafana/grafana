///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv) {}

  query(options) {
    return this.backendSrv.post('/api/tsdb/query', {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        {
          "refId": "A",
          "scenarioId": "random_walk",
          "intervalMs": options.intervalMs,
          "maxDataPoints": options.maxDataPoints,
        }
      ]
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
