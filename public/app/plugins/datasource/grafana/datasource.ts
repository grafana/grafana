///<reference path="../../../headers/common.d.ts" />

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv) {}

  query(options) {
    return this.backendSrv.get('/api/metrics/test', {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      maxDataPoints: options.maxDataPoints
    });
  }
}

export {GrafanaDatasource};
