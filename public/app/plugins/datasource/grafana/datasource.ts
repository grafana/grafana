import _ from 'lodash';
import { getBackendSrv } from '@grafana/runtime';
import { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import templateSrv from 'app/features/templating/template_srv';

class GrafanaDatasource extends DataSourceApi<any> {
  /** @ngInject */
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(options: any) {
    return getBackendSrv()
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
    return Promise.resolve([]);
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
        return Promise.resolve([]);
      }
      // filter by dashboard id
      params.dashboardId = options.dashboard.id;
      // remove tags filter if any
      delete params.tags;
    } else {
      // require at least one tag
      if (!_.isArray(options.annotation.tags) || options.annotation.tags.length === 0) {
        return Promise.resolve([]);
      }
      const delimiter = '__delimiter__';
      const tags = [];
      for (const t of params.tags) {
        const renderedValues = templateSrv.replace(t, {}, (value: any) => {
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

    return getBackendSrv().get(
      '/api/annotations',
      params,
      `grafana-data-source-annotations-${options.annotation.name}-${options.dashboard?.id}`
    );
  }

  testDatasource() {
    return Promise.resolve();
  }
}

export { GrafanaDatasource };
