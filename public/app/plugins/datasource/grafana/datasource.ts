import _ from 'lodash';
import { BackendSrv } from 'app/core/services/backend_srv';
import { IQService } from 'angular';
import { TemplateSrv } from 'app/features/templating/template_srv';

class GrafanaDatasource {
  /** @ngInject */
  constructor(private backendSrv: BackendSrv, private $q: IQService, private templateSrv: TemplateSrv) {}

  query(options: any) {
    return this.backendSrv
      .get('/api/tsdb/testdata/random-walk', {
        from: options.range.from.valueOf(),
        to: options.range.to.valueOf(),
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
      })
      .then((res: any) => {
        const data: any[] = [];

        if (res.results) {
          _.forEach(res.results, queryRes => {
            for (const series of queryRes.series) {
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

  metricFindQuery(options: any) {
    return this.$q.when({ data: [] });
  }

  annotationQuery(options: any) {
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: options.annotation.limit,
      tags: options.annotation.tags,
      matchAny: options.annotation.matchAny,
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
      const delimiter = '__delimiter__';
      const tags = [];
      for (const t of params.tags) {
        const renderedValues = this.templateSrv.replace(t, {}, (value: any) => {
          if (typeof value === 'string') {
            return value;
          }

          return value.join(delimiter);
        });
        for (const tt of renderedValues.split(delimiter)) {
          tags.push(tt);
        }
      }
      params.tags = tags;
    }

    return this.backendSrv.get('/api/annotations', params);
  }
}

export { GrafanaDatasource };
