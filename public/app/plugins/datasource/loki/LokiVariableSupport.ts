import { from, type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  CustomVariableSupport,
  type DataQueryRequest,
  type MetricFindValue,
  type ScopedVars,
  type TimeRange,
} from '@grafana/data/types';

import { LokiVariableQueryEditor } from './components/VariableQueryEditor';
import { type LokiDatasource } from './datasource';
import { type LokiVariableQuery } from './types';

export class LokiVariableSupport extends CustomVariableSupport<LokiDatasource, LokiVariableQuery> {
  editor = LokiVariableQueryEditor;

  constructor(private datasource: LokiDatasource) {
    super();
  }

  async execute(query: LokiVariableQuery, scopedVars: ScopedVars, range: TimeRange) {
    return this.datasource.metricFindQuery(query, { scopedVars, range });
  }

  query(request: DataQueryRequest<LokiVariableQuery>): Observable<{ data: MetricFindValue[] }> {
    const result = this.execute(request.targets[0], request.scopedVars, request.range);

    return from(result).pipe(map((data) => ({ data })));
  }
}
