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

        return {data: data};
      });
  }

  metricFindQuery(options) {
    return this.$q.when({data: []});
  }

  getAnnotationTagString(tags): string | null {
    if (_.isArray(tags)) {
      return tags.join(',');
    }
    return null;
  }

  annotationQuery(options) {
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: options.annotation.limit,
      tags: this.getAnnotationTagString(options.annotation.tags),
    };

    if (options.annotation.type === 'dashboard') {
      params.dashboardId = options.dashboard.id;
      params.tags = '';
    }

    return this.backendSrv.get('/api/annotations', params);
  }
}

export {GrafanaDatasource};
