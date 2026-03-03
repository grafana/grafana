import { ComponentType } from 'react';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  DataSourceApi,
  QueryEditorProps,
} from '@grafana/data';

import { migrateVariableQuery, updateFrame, refId } from './ElasticsearchVariableUtils';
import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticsearchOptions } from './types';

export class ElasticsearchVariableSupport<
  DS extends DataSourceApi<ElasticsearchDataQuery, ElasticsearchOptions>,
> extends CustomVariableSupport<DS, ElasticsearchDataQuery, ElasticsearchDataQuery, ElasticsearchOptions> {
  constructor(
    readonly datasource: DS,
    public editor: ComponentType<QueryEditorProps<DS, ElasticsearchDataQuery, ElasticsearchOptions>>
  ) {
    super();
  }

  query(request: DataQueryRequest<ElasticsearchDataQuery>): Observable<DataQueryResponse> {
    if (request.targets.length < 1) {
      throw new Error('no variable query found');
    }
    const updatedQuery = migrateVariableQuery(request.targets[0]);
    return from(this.datasource.query({ ...request, targets: [updatedQuery] })).pipe(
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
