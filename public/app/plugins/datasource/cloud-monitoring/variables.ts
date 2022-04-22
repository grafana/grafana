import { from, Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import CloudMonitoringMetricFindQuery from './CloudMonitoringMetricFindQuery';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import CloudMonitoringDatasource from './datasource';
import { CloudMonitoringVariableQuery } from './types';

export class CloudMonitoringVariableSupport extends CustomVariableSupport<
  CloudMonitoringDatasource,
  CloudMonitoringVariableQuery
> {
  private readonly metricFindQuery: CloudMonitoringMetricFindQuery;

  constructor(private readonly datasource: CloudMonitoringDatasource) {
    super();
    this.metricFindQuery = new CloudMonitoringMetricFindQuery(datasource);
    this.query = this.query.bind(this);
  }

  editor = CloudMonitoringVariableQueryEditor;

  query(request: DataQueryRequest<CloudMonitoringVariableQuery>): Observable<DataQueryResponse> {
    const executeObservable = from(this.metricFindQuery.execute(request.targets[0]));
    return from(this.datasource.ensureGCEDefaultProject()).pipe(
      mergeMap(() => executeObservable),
      map((data) => ({ data }))
    );
  }
}
