import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { DataQueryRequest, CustomVariableSupport, MetricFindValue } from '@grafana/data';

import { TempoVariableQuery, TempoVariableQueryEditor } from './VariableQueryEditor';
import { TempoDatasource } from './datasource';

export class TempoVariableSupport extends CustomVariableSupport<TempoDatasource, TempoVariableQuery> {
  editor = TempoVariableQueryEditor;

  constructor(private datasource: TempoDatasource) {
    super();
  }

  query(request: DataQueryRequest<TempoVariableQuery>): Observable<{ data: MetricFindValue[] }> {
    if (!this.datasource) {
      throw new Error('Datasource not initialized');
    }

    const result = this.datasource.executeVariableQuery(request.targets[0], request.range);
    return from(result).pipe(map((data) => ({ data })));
  }
}
