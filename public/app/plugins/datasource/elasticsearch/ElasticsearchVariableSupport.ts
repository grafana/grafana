import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, DataFrame } from '@grafana/data';

import { ElasticsearchVariableEditor } from './ElasticsearchVariableEditor';
import { migrateVariableQuery, updateFrame, refId } from './ElasticsearchVariableUtils';
import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticDatasource } from './datasource';

export class ElasticsearchVariableSupport extends CustomVariableSupport<
  ElasticDatasource,
  ElasticsearchDataQuery
> {
  constructor(readonly datasource: ElasticDatasource) {
    super();
  }

  editor = ElasticsearchVariableEditor;

  query(request: DataQueryRequest<ElasticsearchDataQuery>): Observable<DataQueryResponse> {
    if (request.targets.length < 1) {
      throw new Error('no variable query found');
    }
    const updatedQuery = migrateVariableQuery(request.targets[0]);
    return this.datasource.query({ ...request, targets: [updatedQuery] }).pipe(
      map((d: DataQueryResponse) => {
        return {
          ...d,
          data: (d.data || []).map((frame: DataFrame) => updateFrame(frame, updatedQuery.meta)),
        };
      })
    );
  }

  getDefaultQuery(): Partial<ElasticsearchDataQuery> {
    return {
      refId,
      query: '',
      metrics: [{ type: 'raw_document', id: '1' }],
    };
  }
}
