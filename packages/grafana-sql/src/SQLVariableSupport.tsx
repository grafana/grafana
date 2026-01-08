import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  QueryEditorProps,
  Field,
  DataFrame,
} from '@grafana/data';
import { EditorMode } from '@grafana/plugin-ui';

import { SqlQueryEditorLazy } from './components/QueryEditorLazy';
import { SqlDatasource } from './datasource/SqlDatasource';
import { applyQueryDefaults } from './defaults';
import { type SQLQuery, type SQLOptions, QueryFormat } from './types';

type SQLVariableQuery = { query: string } & SQLQuery;

const refId = 'SQLVariableQueryEditor-VariableQuery';

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
            fields: convertOriginalFieldsToVariableFields(frame.fields),
          })),
        };
      })
    );
  }
  getDefaultQuery(): Partial<SQLQuery> {
    return applyQueryDefaults({ refId, editorMode: EditorMode.Builder, format: QueryFormat.Table });
  }
}

const SQLVariablesQueryEditor = (props: QueryEditorProps<SqlDatasource, SQLQuery, SQLOptions>) => {
  return <SqlQueryEditorLazy {...props} query={migrateVariableQuery(props.query)} />;
};

const migrateVariableQuery = (rawQuery: string | SQLQuery): SQLVariableQuery => {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      refId: rawQuery.refId || refId,
      query: rawQuery.rawSql || '',
    };
  }
  return {
    ...applyQueryDefaults({
      refId,
      rawSql: rawQuery,
      editorMode: rawQuery ? EditorMode.Code : EditorMode.Builder,
    }),
    query: rawQuery,
  };
};

const convertOriginalFieldsToVariableFields = (original_fields: Field[]): Field[] => {
  if (original_fields.length < 1) {
    throw new Error('at least one field expected for variable');
  }
  let tf = original_fields.find((f) => f.name === '__text');
  let vf = original_fields.find((f) => f.name === '__value');
  const textField = tf || vf || original_fields[0];
  const valueField = vf || tf || original_fields[0];
  return [
    { ...textField, name: 'text' },
    { ...valueField, name: 'value' },
  ];
};
