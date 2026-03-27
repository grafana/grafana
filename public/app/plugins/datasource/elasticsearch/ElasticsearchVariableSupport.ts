import { ComponentType } from 'react';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  DataFrame,
  DataSourceApi,
  FieldType,
  MetricFindValue,
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

    if (updatedQuery.queryType === 'legacy_variable') {
      return this.legacyQuery(updatedQuery, request);
    }

    return from(this.datasource.query({ ...request, targets: [updatedQuery] })).pipe(
      map((d: DataQueryResponse) => {
        return {
          ...d,
          data: (d.data || []).map((frame: DataFrame) => updateFrame(frame, updatedQuery.meta)),
        };
      })
    );
  }

  private legacyQuery(
    query: ElasticsearchDataQuery,
    request: DataQueryRequest<ElasticsearchDataQuery>
  ): Observable<DataQueryResponse> {
    if (!this.datasource.metricFindQuery) {
      return from(Promise.resolve({ data: [] }));
    }
    return from(this.datasource.metricFindQuery(query.query || '', { range: request.range })).pipe(
      map((values: MetricFindValue[]) => {
        const frame: DataFrame = {
          fields: [
            {
              name: 'text',
              type: FieldType.string,
              config: {},
              values: values.map((v) => String(v.text)),
            },
            {
              name: 'value',
              type: FieldType.string,
              config: {},
              values: values.map((v) => String(v.value ?? v.text)),
            },
          ],
          length: values.length,
        };
        const response: DataQueryResponse = { data: [frame] };
        return response;
      })
    );
  }

  getDefaultQuery(): Partial<ElasticsearchDataQuery> {
    return {
      refId,
      query: '',
      metrics: [{ type: 'count', id: '1' }],
    };
  }
}
