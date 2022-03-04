import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import { CloudWatchDatasource } from './datasource';
import { VariableQuery } from './types';
import MetricFindQuery from './metricFindQuery';
import { migrateVariableQuery } from './migrations';
import VariableQueryEditor from './components/VariableQueryEditor';

export class CloudWatchVariableSupport extends CustomVariableSupport<CloudWatchDatasource, VariableQuery> {
  private readonly metricFindQuery: MetricFindQuery;

  constructor(datasource: CloudWatchDatasource) {
    super();
    this.metricFindQuery = new MetricFindQuery(datasource);
    this.query = this.query.bind(this);
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<VariableQuery>): Observable<DataQueryResponse> {
    const queryObj = migrateVariableQuery(request.targets[0]);
    return from(this.metricFindQuery.execute(queryObj)).pipe(map((data) => ({ data })));
  }
}
