import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LiveChannelScope,
  LiveChannelSupport,
} from '@grafana/data';

import { GrafanaQuery, GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQueryType } from './types';
import { getBackendSrv, getGrafanaLiveSrv, getTemplateSrv, toDataQueryResponse } from '@grafana/runtime';
import { Observable, of } from 'rxjs';
import { map, catchError, filter } from 'rxjs/operators';

export class GrafanaDatasource extends DataSourceApi<GrafanaQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  // NOT real becasue GrafanaDatasource is not a real datasource
  channelSupport: LiveChannelSupport = {
    getChannelConfig: (path: string) => {
      return {
        path,
      }; // nothing special -- but can listen on that channel
    },
    getSupportedPaths: () => [],
  };

  query(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const queries: Array<Observable<DataQueryResponse>> = [];
    for (const target of request.targets) {
      if (target.hide) {
        continue;
      }
      if (target.queryType === GrafanaQueryType.LiveMetrics) {
        queries.push(this.getChannelObserver(target.channel || 'live'));
      } else {
        queries.push(this.getRandomWalk(request));
      }
    }
    if (queries.length === 1) {
      return queries[0];
    }
    if (queries.length > 1) {
      // HELP!
      return queries[0];
    }
    return of(); // nothing
  }

  private getChannelObserver(path: string): Observable<DataQueryResponse> {
    const live = getGrafanaLiveSrv();
    if (!live) {
      // This will only happen with the feature flag is not enabled
      return of({ error: { message: 'Grafana live is not initalized' }, data: [] });
    }

    console.log('CONNCET', path);
    return live
      .getChannel(LiveChannelScope.Grafana, 'metrics', path)
      .getStream()
      .pipe(
        filter(v => !!!v.message),
        map(v => {
          const r: DataQueryResponse = {
            data: [],
          };
          console.log('MESSAGE', v, r);
          return r;
        })
      );
  }

  private getRandomWalk(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const { intervalMs, maxDataPoints, range, requestId } = request;
    const params: Record<string, any> = {
      intervalMs,
      maxDataPoints,
      from: range.from.valueOf(),
      to: range.to.valueOf(),
    };

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

  annotationQuery(options: AnnotationQueryRequest<GrafanaQuery>): Promise<AnnotationEvent[]> {
    const templateSrv = getTemplateSrv();
    const annotation = (options.annotation as unknown) as GrafanaAnnotationQuery;
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: annotation.limit,
      tags: annotation.tags,
      matchAny: annotation.matchAny,
    };

    if (annotation.type === GrafanaAnnotationType.Dashboard) {
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
      if (!Array.isArray(annotation.tags) || annotation.tags.length === 0) {
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
      `grafana-data-source-annotations-${annotation.name}-${options.dashboard?.id}`
    );
  }

  testDatasource() {
    return Promise.resolve();
  }
}
