import { type Observable } from 'rxjs';

import { type DataQueryRequest, type DataQueryResponse, type DataSourceInstanceSettings } from '@grafana/data';
import { type TemplateSrv } from '@grafana/runtime';

import { type CloudWatchAnnotationQuery } from '../dataquery.gen';
import { type CloudWatchJsonData, type CloudWatchQuery } from '../types';

import { CloudWatchRequest } from './CloudWatchRequest';

// This class handles execution of CloudWatch annotation queries
export class CloudWatchAnnotationQueryRunner extends CloudWatchRequest {
  constructor(instanceSettings: DataSourceInstanceSettings<CloudWatchJsonData>, templateSrv: TemplateSrv) {
    super(instanceSettings, templateSrv);
  }

  handleAnnotationQuery(
    queries: CloudWatchAnnotationQuery[],
    options: DataQueryRequest<CloudWatchQuery>,
    queryFn: (request: DataQueryRequest<CloudWatchQuery>) => Observable<DataQueryResponse>
  ): Observable<DataQueryResponse> {
    return queryFn({
      ...options,
      targets: queries.map((query) => ({
        ...query,
        statistic: this.templateSrv.replace(query.statistic),
        region: this.templateSrv.replace(this.getActualRegion(query.region)),
        namespace: this.templateSrv.replace(query.namespace),
        metricName: this.templateSrv.replace(query.metricName),
        dimensions: this.convertDimensionFormat(query.dimensions ?? {}, {}),
        period: query.period ?? '',
        actionPrefix: query.actionPrefix ?? '',
        alarmNamePrefix: query.alarmNamePrefix ?? '',
        type: 'annotationQuery',
        datasource: this.ref,
      })),
    });
  }
}
