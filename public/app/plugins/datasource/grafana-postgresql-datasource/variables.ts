import { from, map, Observable } from 'rxjs';

import { CustomVariableSupport, DataQueryRequest, MetricFindValue } from '@grafana/data';
import { applyQueryDefaults, SQLQuery } from '@grafana/sql';

import { VariableQueryEditor } from './VariableQueryEditor';
import { PostgresDatasource } from './datasource';
import { migrateVariableQuery } from './migrations';

export class SQLVariableSupport extends CustomVariableSupport<PostgresDatasource, SQLQuery> {
  constructor(private readonly datasource: PostgresDatasource) {
    super();
  }

  editor = VariableQueryEditor;

  query(request: DataQueryRequest<SQLQuery>): Observable<{ data: MetricFindValue[] }> {
    const queryObj = migrateVariableQuery(request.targets[0]);
    const result = this.datasource.metricFindQuery(queryObj, { scopedVars: request.scopedVars, range: request.range });

    return from(result).pipe(map((data) => ({ data })));
  }

  getDefaultQuery(): Partial<SQLQuery> {
    return applyQueryDefaults({ refId: 'SQLVariableQueryEditor-VariableQuery' });
  }
}
