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
  TimeRange,
} from '@grafana/data';

import { migrateVariableQuery, parseLegacyFindQuery, updateFrame, refId } from './ElasticsearchVariableUtils';
import { ElasticsearchDataQuery } from './dataquery.gen';
import { ElasticsearchOptions } from './types';

// Minimal interface for the datasource capabilities needed by the variable support.
interface ElasticsearchDatasourceWithFields {
  getFields(type?: string[], range?: TimeRange): Observable<MetricFindValue[]>;
}

const hasGetFields = (ds: unknown): ds is ElasticsearchDatasourceWithFields =>
  typeof ds === 'object' && ds !== null && 'getFields' in ds;

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

    // Legacy {"find":"fields","type":"keyword"} queries can't be expressed as a metric query —
    // they call the mapping API. Intercept before migrating and handle directly.
    const rawTarget = request.targets[0];
    const rawString = typeof rawTarget === 'string' ? rawTarget : undefined;
    if (rawString) {
      const legacy = parseLegacyFindQuery(rawString);
      if (legacy?.find === 'fields' && hasGetFields(this.datasource)) {
        const types = legacy.type ? [legacy.type] : undefined;
        return this.datasource.getFields(types, request.range).pipe(
          map((fields: MetricFindValue[]) => {
            const names = fields.map((f) => String(f.text));
            const frame: DataFrame = {
              name: 'fields',
              refId,
              length: names.length,
              fields: [
                { name: '__text', type: FieldType.string, config: {}, values: names },
                { name: '__value', type: FieldType.string, config: {}, values: names },
              ],
            };
            return { data: [frame] };
          })
        );
      }
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
