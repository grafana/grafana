import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';

import CloudMonitoringDatasource from './datasource';
import { CloudMonitoringVariableQuery } from './types';
import CloudMonitoringMetricFindQuery from './CloudMonitoringMetricFindQuery';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';

export class CloudMonitoringVariableSupport
  implements CustomVariableSupport<CloudMonitoringDatasource, CloudMonitoringVariableQuery> {
  private readonly metricFindQuery: CloudMonitoringMetricFindQuery;

  constructor(private readonly datasource: CloudMonitoringDatasource) {
    this.metricFindQuery = new CloudMonitoringMetricFindQuery(datasource);
  }

  editor = CloudMonitoringVariableQueryEditor;

  query(request: DataQueryRequest<CloudMonitoringVariableQuery>): Observable<DataQueryResponse> {
    return from(this.datasource.ensureGCEDefaultProject()).pipe(
      mergeMap(() => {
        return from(this.metricFindQuery.execute(request.targets[0]));
      })
    );
  }
}
