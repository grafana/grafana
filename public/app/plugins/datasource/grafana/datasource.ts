import { from, merge, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getBackendSrv, getGrafanaLiveSrv, getTemplateSrv, toDataQueryResponse } from '@grafana/runtime';
import {
  AnnotationQuery,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  isValidLiveChannelAddress,
  parseLiveChannelAddress,
  StreamingFrameOptions,
  toDataFrame,
} from '@grafana/data';

import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery, GrafanaQueryType } from './types';
import AnnotationQueryEditor from './components/AnnotationQueryEditor';
import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';

let counter = 100;

export class GrafanaDatasource extends DataSourceApi<GrafanaQuery> {
  constructor(instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
    this.annotations = {
      QueryEditor: AnnotationQueryEditor,
      prepareAnnotation(json: any): AnnotationQuery<GrafanaAnnotationQuery> {
        // Previously, these properties lived outside of target
        // This should handle migrating them
        json.target = json.target ?? {
          type: json.type ?? GrafanaAnnotationType.Dashboard,
          limit: json.limit ?? 100,
          tags: json.tags ?? [],
          matchAny: json.matchAny ?? false,
        }; // using spread syntax caused an infinite loop in StandardAnnotationQueryEditor
        return json;
      },
      prepareQuery(anno: AnnotationQuery<GrafanaAnnotationQuery>): GrafanaQuery {
        return { ...anno, refId: anno.name, queryType: GrafanaQueryType.Annotations };
      },
    };
  }

  query(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const queries: Array<Observable<DataQueryResponse>> = [];
    const templateSrv = getTemplateSrv();
    for (const target of request.targets) {
      if (target.queryType === GrafanaQueryType.Annotations) {
        return from(
          this.getAnnotations({
            range: request.range,
            rangeRaw: request.range.raw,
            annotation: (target as unknown) as AnnotationQuery<GrafanaAnnotationQuery>,
            dashboard: getDashboardSrv().getCurrent(),
          })
        );
      }
      if (target.hide) {
        continue;
      }
      if (target.queryType === GrafanaQueryType.LiveMeasurements) {
        let channel = templateSrv.replace(target.channel, request.scopedVars);
        const { filter } = target;

        // Help migrate pre-release channel paths saved in dashboards
        // NOTE: this should be removed before V8 is released
        if (channel && channel.startsWith('telegraf/')) {
          channel = 'stream/' + channel;
          target.channel = channel; // mutate the current query object so it is saved with `stream/` prefix
        }

        const addr = parseLiveChannelAddress(channel);
        if (!isValidLiveChannelAddress(addr)) {
          continue;
        }
        const buffer: StreamingFrameOptions = {
          maxLength: request.maxDataPoints ?? 500,
        };
        if (target.buffer) {
          buffer.maxDelta = target.buffer;
          buffer.maxLength = buffer.maxLength! * 2; //??
        } else if (request.rangeRaw?.to === 'now') {
          buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
        }

        queries.push(
          getGrafanaLiveSrv().getDataStream({
            key: `${request.requestId}.${counter++}`,
            addr: addr!,
            filter,
            buffer,
          })
        );
      } else {
        queries.push(getRandomWalk(request));
      }
    }
    // With a single query just return the results
    if (queries.length === 1) {
      return queries[0];
    }
    if (queries.length > 1) {
      return merge(...queries);
    }
    return of(); // nothing
  }

  metricFindQuery(options: any) {
    return Promise.resolve([]);
  }

  async getAnnotations(options: AnnotationQueryRequest<GrafanaQuery>): Promise<DataQueryResponse> {
    const templateSrv = getTemplateSrv();
    const annotation = (options.annotation as unknown) as AnnotationQuery<GrafanaAnnotationQuery>;
    const target = annotation.target!;
    const params: any = {
      from: options.range.from.valueOf(),
      to: options.range.to.valueOf(),
      limit: target.limit,
      tags: target.tags,
      matchAny: target.matchAny,
    };

    if (target.type === GrafanaAnnotationType.Dashboard) {
      // if no dashboard id yet return
      if (!options.dashboard.id) {
        return Promise.resolve({ data: [] });
      }
      // filter by dashboard id
      params.dashboardId = options.dashboard.id;
      // remove tags filter if any
      delete params.tags;
    } else {
      // require at least one tag
      if (!Array.isArray(target.tags) || target.tags.length === 0) {
        return Promise.resolve({ data: [] });
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

    const annotations = await getBackendSrv().get(
      '/api/annotations',
      params,
      `grafana-data-source-annotations-${annotation.name}-${options.dashboard?.id}`
    );
    return { data: [toDataFrame(annotations)] };
  }

  testDatasource() {
    return Promise.resolve();
  }
}

// Note that the query does not actually matter
function getRandomWalk(request: DataQueryRequest): Observable<DataQueryResponse> {
  const { intervalMs, maxDataPoints, range, requestId } = request;

  // Yes, this implementation ignores multiple targets!  But that matches existing behavior
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
      catchError((err) => {
        return of(toDataQueryResponse(err));
      })
    );
}
