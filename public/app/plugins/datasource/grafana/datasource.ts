///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

class GrafanaDatasource {

  /** @ngInject */
  constructor(private backendSrv, private $q) {}

  query(options) {
    return this.$q.when({data: []});
  }

  metricFindQuery() {
    return this.$q.when([]);
  };

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
