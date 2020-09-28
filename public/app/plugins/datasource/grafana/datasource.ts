import { DataQueryRequest, DataQueryResponse, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';

import { GrafanaQuery } from './types';
import { getBackendSrv, getTemplateSrv, toDataQueryResponse } from '@grafana/runtime';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export class GrafanaDatasource extends DataSourceApi<GrafanaQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  query(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId } = request;
    const params: Record<string, any> = {
      intervalMs,
      maxDataPoints,
    };
    if (range) {
      params.from = range.from.valueOf(); //.toString();
      params.to = range.to.valueOf(); //.toString();
    }

    return getBackendSrv()
      .fetch({
        url: '/api/tsdb/testdata/random-walk',
        method: 'GET',
        params,
        requestId,
      })
      .pipe(
        map((rsp: any) => {
          return toDataQueryResponse(rsp);
        }),
        catchError(err => {
          return of(toDataQueryResponse(err));
        })
      );
  }

  metricFindQuery(options: any) {
    return Promise.resolve([]);
  }

  annotationQuery(options: any) {
    const templateSrv = getTemplateSrv();
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
