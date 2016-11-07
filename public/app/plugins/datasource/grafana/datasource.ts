///<reference path="../../../headers/common.d.ts" />

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv) {}

  query(options) {
    return this.backendSrv.get('/api/metrics/test', {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      scenario: 'random_walk',
      interval: options.intervalMs,
      maxDataPoints: options.maxDataPoints
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
