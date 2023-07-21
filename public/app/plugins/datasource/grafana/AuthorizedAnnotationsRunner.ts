import {
  AnnotationQuery,
  AnnotationQueryRequest,
  DataQuery,
  DataQueryRequest,
  DataQueryResponse,
  toDataFrame,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';

import { getDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';

import { AnnotationsRunner } from './AnnotationsRunner';
import { doTimeRegionQuery } from './timeRegions';
import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQuery, GrafanaQueryType } from './types';

export class AuthorizedAnnotationsRunner implements AnnotationsRunner {
  async getAnnotations(
    request: DataQueryRequest<DataQuery>,
    options: AnnotationQueryRequest<GrafanaQuery>
  ): Promise<DataQueryResponse> {
    const query = options.annotation.target as GrafanaQuery;
    if (query?.queryType === GrafanaQueryType.TimeRegions) {
      const frame = doTimeRegionQuery(
        options.annotation.name,
        query.timeRegion!,
        options.range,
        getDashboardSrv().getCurrent()?.timezone // Annotation queries don't include the timezone
      );
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

    console.log('getting annotations');
    const annotations = await getBackendSrv().get(
      '/api/annotations',
      params,
      `grafana-data-source-annotations-${annotation.name}-${options.dashboard?.uid}`
    );
    return { data: [toDataFrame(annotations)] };
  }
}
