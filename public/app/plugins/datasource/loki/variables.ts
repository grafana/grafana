import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { LokiVariableQueryEditor } from './components/VariableQueryEditor';
import { LokiDatasource } from './datasource';
import { LokiVariableQuery } from './types';

export class LokiVariableSupport extends CustomVariableSupport<LokiDatasource, LokiVariableQuery> {
  editor = LokiVariableQueryEditor;

  constructor(private datasource: LokiDatasource) {
    super();
    this.query = this.query.bind(this);
  }

  async execute(query: LokiVariableQuery) {
    return this.datasource.metricFindQuery(query);
  }

  query(request: DataQueryRequest<LokiVariableQuery>): Observable<DataQueryResponse> {
    const result = this.execute(request.targets[0]);

    return from(result).pipe(map((data) => ({ data })));
  }
}
