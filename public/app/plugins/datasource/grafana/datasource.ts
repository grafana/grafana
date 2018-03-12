import _ from 'lodash';

class GrafanaDatasource {
  /** @ngInject */
  constructor(private backendSrv, private $q) {}

  query(options) {
    return this.backendSrv
      .get('/api/tsdb/testdata/random-walk', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
      })
      .then(res => {
        var data = [];

        if (res.results) {
          _.forEach(res.results, queryRes => {
            for (let series of queryRes.series) {
              data.push({
                target: series.name,
                datapoints: series.points,
              });
            }
          });
        }

        return { data: data };
      });
  }

  metricFindQuery(options) {
    return this.$q.when({ data: [] });
  }

  annotationQuery(options) {
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: options.annotation.limit,
      tags: options.annotation.tags,
    };

    if (options.annotation.type === 'dashboard') {
      // if no dashboard id yet return
      if (!options.dashboard.id) {
        return this.$q.when([]);
      }
      // filter by dashboard id
      params.dashboardId = options.dashboard.id;
      // remove tags filter if any
      delete params.tags;
    } else {
      // require at least one tag
      if (!_.isArray(options.annotation.tags) || options.annotation.tags.length === 0) {
        return this.$q.when([]);
      }
    }

    return this.backendSrv.get('/api/annotations', params);
  }
}

export { GrafanaDatasource };
