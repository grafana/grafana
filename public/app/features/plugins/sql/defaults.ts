import { EditorMode } from '@grafana/experimental';

import { QueryFormat, SQLQuery } from './types';
import { createFunctionField, setGroupByField } from './utils/sql.utils';

export function applyQueryDefaults(q?: SQLQuery, override: Partial<SQLQuery> = { sql: {} }): SQLQuery {
  let editorMode = q?.editorMode || EditorMode.Builder;

  // Switching to code editor if the query was created before visual query builder was introduced.
  if (q?.editorMode === undefined && q?.rawSql !== undefined) {
    editorMode = EditorMode.Code;
  }

  const result: SQLQuery = {
    ...q,
    refId: q?.refId || 'A',
    format: q?.format !== undefined ? q.format : QueryFormat.Table,
    rawSql: q?.rawSql || '',
    editorMode,
    ...override,
    sql: q?.sql ?? {
      columns: [createFunctionField()],
      groupBy: [setGroupByField()],
      limit: 50,
      ...override?.sql,
    },
  };

  return result;
}

export type QueryWithDefaults = ReturnType<typeof applyQueryDefaults>;
