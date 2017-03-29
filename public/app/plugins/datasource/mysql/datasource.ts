///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

export class MysqlDatasource {
  id: any;
  name: any;

  /** @ngInject */
  constructor(instanceSettings, private backendSrv) {
    this.name = instanceSettings.name;
    this.id = instanceSettings.id;
  }

  query(options) {
    return this.backendSrv.post('/api/tsdb/query', {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: [
        {
          "refId": "A",
          "intervalMs": options.intervalMs,
          "maxDataPoints": options.maxDataPoints,
          "datasourceId": this.id,
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
}

