import { Observable } from 'rxjs';
import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import VariableEditor, { migrateStringQueriesToObjectQueries } from './VariableEditor';
import DataSource from '../../datasource';
import { AzureMonitorQuery } from '../../types';

export class VariableSupport extends CustomVariableSupport<DataSource, AzureMonitorQuery> {
  constructor(private readonly datasource: DataSource) {
    super();
    this.datasource = datasource;
    this.query = this.query.bind(this);
  }

  editor = VariableEditor;

  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    request.targets = request.targets.map((target) => {
      return migrateStringQueriesToObjectQueries(target, { datasource: this.datasource });
    });
    return this.datasource.query(request);
  }
}
