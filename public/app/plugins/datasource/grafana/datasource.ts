import { isString } from 'lodash';
import { from, merge, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  AnnotationQuery,
  AnnotationQueryRequest,
  DataFrameView,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceRef,
  isValidLiveChannelAddress,
  MutableDataFrame,
  parseLiveChannelAddress,
  toDataFrame,
  dataFrameFromJSON,
  LoadingState,
} from '@grafana/data';
import {
  DataSourceWithBackend,
  getBackendSrv,
  getDataSourceSrv,
  getGrafanaLiveSrv,
  getTemplateSrv,
  StreamingFrameOptions,
} from '@grafana/runtime';
import { migrateDatasourceNameToRef } from 'app/features/dashboard/state/DashboardMigrator';

import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';

import AnnotationQueryEditor from './components/AnnotationQueryEditor';
import { doTimeRegionQuery } from './timeRegions';
import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery, GrafanaQueryType } from './types';

let counter = 100;

export class GrafanaDatasource extends DataSourceWithBackend<GrafanaQuery> {
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
        let datasource: DataSourceRef | undefined | null = undefined;
        if (isString(anno.datasource)) {
          const ref = migrateDatasourceNameToRef(anno.datasource, { returnDefaultAsNull: false });
          if (ref) {
            datasource = ref;
          }
        } else {
          datasource = anno.datasource as DataSourceRef;
        }

        return { ...anno, refId: anno.name, queryType: GrafanaQueryType.Annotations, datasource };
      },
    };
  }

  getDefaultQuery(): Partial<GrafanaQuery> {
    return {
      queryType: GrafanaQueryType.RandomWalk,
    };
  }

  query(request: DataQueryRequest<GrafanaQuery>): Observable<DataQueryResponse> {
    const results: Array<Observable<DataQueryResponse>> = [];
    const targets: GrafanaQuery[] = [];
    const templateSrv = getTemplateSrv();
    for (const target of request.targets) {
      if (target.queryType === GrafanaQueryType.Annotations) {
        return from(
          this.getAnnotations({
            range: request.range,
            rangeRaw: request.range.raw,
            annotation: target as unknown as AnnotationQuery<GrafanaAnnotationQuery>,
            dashboard: getDashboardSrv().getCurrent(),
          })
        );
      }
      if (target.hide) {
        continue;
      }
      if (target.queryType === GrafanaQueryType.Snapshot) {
        results.push(
          of({
            // NOTE refId is intentionally missing because:
            // 1) there is only one snapshot
            // 2) the payload will reference original refIds
            data: (target.snapshot ?? []).map((v) => dataFrameFromJSON(v)),
            state: LoadingState.Done,
          })
        );
        continue;
      }
      if (target.queryType === GrafanaQueryType.TimeRegions) {
        const frame = doTimeRegionQuery('', target.timeRegion!, request.range, request.timezone);
        results.push(
          of({
            data: frame ? [frame] : [],
            state: LoadingState.Done,
          })
        );
        continue;
      }
      if (target.queryType === GrafanaQueryType.LiveMeasurements) {
        let channel = templateSrv.replace(target.channel, request.scopedVars);
        const { filter } = target;

        const addr = parseLiveChannelAddress(channel);
        if (!isValidLiveChannelAddress(addr)) {
          continue;
        }
        const buffer: Partial<StreamingFrameOptions> = {
          maxLength: request.maxDataPoints ?? 500,
        };
        if (target.buffer) {
          buffer.maxDelta = target.buffer;
          buffer.maxLength = buffer.maxLength! * 2; //??
        } else if (request.rangeRaw?.to === 'now') {
          buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
        }

        results.push(
          getGrafanaLiveSrv().getDataStream({
            key: `${request.requestId}.${counter++}`,
            addr: addr!,
            filter,
            buffer,
          })
        );
      } else {
        if (!target.queryType) {
          target.queryType = GrafanaQueryType.RandomWalk;
        }
        targets.push(target);
      }
    }

    if (targets.length) {
      results.push(
        super.query({
          ...request,
          targets,
        })
      );
    }

    if (results.length) {
      // With a single query just return the results
      if (results.length === 1) {
        return results[0];
      }
      return merge(...results);
    }
    return of(); // nothing
  }

  listFiles(path: string): Observable<DataFrameView<FileElement>> {
    return this.query({
      targets: [
        {
          refId: 'A',
          queryType: GrafanaQueryType.List,
          path,
        },
      ],
    } as any).pipe(
      map((v) => {
        const frame = v.data[0] ?? new MutableDataFrame();
        return new DataFrameView<FileElement>(frame);
      })
    );
  }

  metricFindQuery(options: any) {
    return Promise.resolve([]);
  }

  async getAnnotations(options: AnnotationQueryRequest<GrafanaQuery>): Promise<DataQueryResponse> {
    const query = options.annotation.target as GrafanaQuery;
    if (query?.queryType === GrafanaQueryType.TimeRegions) {
      const frame = doTimeRegionQuery(options.annotation.name, query.timeRegion!, options.range, 'utc'); // << dashboard timezone?
      return Promise.resolve({ data: frame ? [frame] : [] });
    }

    const annotation = options.annotation as unknown as AnnotationQuery<GrafanaAnnotationQuery>;
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
      if (!options.dashboard.uid) {
        return Promise.resolve({ data: [] });
      }
      // filter by dashboard id
      params.dashboardUID = options.dashboard.uid;
      // remove tags filter if any
      delete params.tags;
    } else {
      // require at least one tag
      if (!Array.isArray(target.tags) || target.tags.length === 0) {
        return Promise.resolve({ data: [] });
      }
      const templateSrv = getTemplateSrv();
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
      `grafana-data-source-annotations-${annotation.name}-${options.dashboard?.uid}`
    );
    return { data: [toDataFrame(annotations)] };
  }

  testDatasource() {
    return Promise.resolve();
  }
}

/** Get the GrafanaDatasource instance */
export async function getGrafanaDatasource() {
  return (await getDataSourceSrv().get('-- Grafana --')) as GrafanaDatasource;
}

export interface FileElement {
  name: string;
  ['media-type']: string;
}
