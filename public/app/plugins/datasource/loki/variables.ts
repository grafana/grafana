import { from, Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { LokiVariableQueryEditor } from './components/VariableQueryEditor';
import { LokiDatasource } from './datasource';
import { LokiMetricFindQuery } from './metricFindQuery';
import { LokiVariableQuery } from './types';

export class LokiVariableSupport extends CustomVariableSupport<LokiDatasource, LokiVariableQuery> {
  private metricFindQuery: LokiMetricFindQuery;
  editor = LokiVariableQueryEditor;

  constructor(datasource: LokiDatasource) {
    super();
    this.metricFindQuery = new LokiMetricFindQuery(datasource);
    this.query = this.query.bind(this);
  }

  query(request: DataQueryRequest<LokiVariableQuery>): Observable<DataQueryResponse> {
    const executeObservable = from(this.metricFindQuery.execute(request.targets[0]));

    return from(executeObservable).pipe(
      mergeMap(() => executeObservable),
      map((data) => ({ data }))
    );
  }
}
