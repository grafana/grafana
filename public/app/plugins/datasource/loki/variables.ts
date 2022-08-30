import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { LokiVariableQueryEditor } from './components/VariableQueryEditor';
import { LokiDatasource } from './datasource';
import { LokiVariableQuery, LokiVariableQueryType } from './types';

export class LokiVariableSupport extends CustomVariableSupport<LokiDatasource, LokiVariableQuery> {
  editor = LokiVariableQueryEditor;

  constructor(private datasource: LokiDatasource) {
    super();
    this.query = this.query.bind(this);
  }

  async execute(query: LokiVariableQuery) {
    if (query.type === LokiVariableQueryType.LabelNames) {
      return this.datasource.labelNamesQuery();
    }

    if (!query.label) {
      return [];
    }

    // If we have query expr, use /series endpoint
    if (query.stream) {
      return this.datasource.labelValuesSeriesQuery(query.stream, query.label);
    }

    return this.datasource.labelValuesQuery(query.label);
  }

  query(request: DataQueryRequest<LokiVariableQuery>): Observable<DataQueryResponse> {
    const result = this.execute(request.targets[0]);

    return from(result).pipe(map((data) => ({ data })));
  }
}
