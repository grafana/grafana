import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CustomVariableSupport, DataQueryRequest, DataQueryResponse, DataFrame } from '@grafana/data';
import { EditorMode } from '@grafana/plugin-ui';

import { SQLVariablesQueryEditor } from './SQLVariableEditor';
import { migrateVariableQuery, convertFieldsToVariableFields, refId } from './SQLVariableUtils';
import { SqlDatasource } from './datasource/SqlDatasource';
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
          data: (d.data || []).map((frame: DataFrame) => ({
            ...frame,
            fields: convertFieldsToVariableFields(frame.fields, updatedQuery.meta),
          })),
        };
      })
    );
  }
  getDefaultQuery(): Partial<SQLQuery> {
    return applyQueryDefaults({ refId, editorMode: EditorMode.Builder, format: QueryFormat.Table });
  }
}
