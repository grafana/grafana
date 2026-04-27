import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, type DataQueryRequest, type DataQueryResponse } from '@grafana/data';
import { type DataFrame } from '@grafana/data/dataframe';
import { EditorMode } from '@grafana/plugin-ui';

import { SQLVariablesQueryEditor } from './SQLVariableEditor';
import { migrateVariableQuery, updateFrame, refId } from './SQLVariableUtils';
import { type SqlDatasource } from './datasource/SqlDatasource';
import { applyQueryDefaults } from './defaults';
import { QueryFormat, type SQLQuery } from './types';

export class SQLVariableSupport extends CustomVariableSupport<SqlDatasource, SQLQuery> {
  constructor(readonly datasource: SqlDatasource) {
    super();
  }
  editor = SQLVariablesQueryEditor;
  query(request: DataQueryRequest<SQLQuery>): Observable<DataQueryResponse> {
    if (request.targets.length < 1) {
      throw new Error('no variable query found');
    }
    const updatedQuery = migrateVariableQuery(request.targets[0]);
    return this.datasource.query({ ...request, targets: [updatedQuery] }).pipe(
      map((d: DataQueryResponse) => {
        return {
          ...d,
          data: (d.data || []).map((frame: DataFrame) => updateFrame(frame, updatedQuery.meta)),
        };
      })
    );
  }
  getDefaultQuery(): Partial<SQLQuery> {
    return applyQueryDefaults({ refId, editorMode: EditorMode.Builder, format: QueryFormat.Table });
  }
}
