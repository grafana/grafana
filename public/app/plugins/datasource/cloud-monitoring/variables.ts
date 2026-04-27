import { from, type Observable } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { CustomVariableSupport, type DataQueryRequest, type DataQueryResponse } from '@grafana/data/types';

import CloudMonitoringMetricFindQuery from './CloudMonitoringMetricFindQuery';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import type CloudMonitoringDatasource from './datasource';
import { type CloudMonitoringVariableQuery } from './types/types';

export class CloudMonitoringVariableSupport extends CustomVariableSupport<
  CloudMonitoringDatasource,
  CloudMonitoringVariableQuery
> {
  private readonly metricFindQuery: CloudMonitoringMetricFindQuery;

  constructor(private readonly datasource: CloudMonitoringDatasource) {
    super();
    this.metricFindQuery = new CloudMonitoringMetricFindQuery(datasource);
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
