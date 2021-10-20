import { DataQueryRequest, DataQueryResponse, getLogLevelFromKey } from '@grafana/data';
import { ElasticsearchQuery } from '../types';
import { Observable } from 'rxjs';
import { cloneDeep } from 'lodash';
import { ElasticDatasource } from '../datasource';
import { queryLogsVolume } from '../../../../core/logs_model';

export function createElasticSearchLogsVolumeProvider(
  datasource: ElasticDatasource,
  dataQueryRequest: DataQueryRequest<ElasticsearchQuery>
): Observable<DataQueryResponse> {
  const logsVolumeRequest = cloneDeep(dataQueryRequest);
  logsVolumeRequest.targets = logsVolumeRequest.targets.map((target) => {
    const logsVolumeQuery: ElasticsearchQuery = {
      refId: target.refId,
      query: target.query,
      metrics: [{ type: 'count', id: '1' }],
      timeField: '@timestamp',
      bucketAggs: [
        {
          id: '2',
          type: 'terms',
          settings: {
            min_doc_count: '0',
            size: '0',
            order: 'desc',
            orderBy: '_count',
          },
          field: 'fields.level',
        },
        {
          id: '3',
          type: 'date_histogram',
          settings: {
            interval: 'auto',
            min_doc_count: '0',
            trimEdges: '0',
          },
          field: '@timestamp',
        },
      ],
    };
    return logsVolumeQuery;
  });

  return queryLogsVolume(datasource, logsVolumeRequest, {
    range: dataQueryRequest.range,
    targets: dataQueryRequest.targets,
    extractLevel: (dataFrame) => getLogLevelFromKey(dataFrame.name || ''),
  });
}
