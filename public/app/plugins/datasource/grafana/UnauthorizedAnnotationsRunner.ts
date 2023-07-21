import { AnnotationQueryRequest, DataQuery, DataQueryRequest, DataQueryResponse, toDataFrame } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';

import { AnnotationsRunner } from './AnnotationsRunner';
import { GrafanaQuery } from './types';

export class UnauthorizedAnnotationsRunner implements AnnotationsRunner {
  async getAnnotations(
    request: DataQueryRequest<DataQuery>,
    options: AnnotationQueryRequest<GrafanaQuery>
  ): Promise<DataQueryResponse> {
    const {
      publicDashboardAccessToken: accessToken,
      range: { to: toDate, from: fromDate },
    } = request;

    const params = {
      from: fromDate.valueOf(),
      to: toDate.valueOf(),
    };

    const annotations = accessToken
      ? await getBackendSrv().get(`/api/public/dashboards/${accessToken}/annotations`, params)
      : [];

    return { data: [toDataFrame(annotations)] };
  }
}
