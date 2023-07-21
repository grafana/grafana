import { AnnotationQueryRequest, DataQuery, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { GrafanaQuery } from './types';

export abstract class AnnotationsRunner {
  abstract getAnnotations(
    request: DataQueryRequest<DataQuery>,
    options: AnnotationQueryRequest<GrafanaQuery>
  ): Promise<DataQueryResponse>;
}
