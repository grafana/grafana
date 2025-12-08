import { applyQueryDefaults, type SQLQuery } from '@grafana/sql';

import type { VariableQuery } from './types';

export function migrateVariableQuery(rawQuery: string | SQLQuery): VariableQuery {
  if (typeof rawQuery !== 'string') {
    return {
      ...rawQuery,
      query: rawQuery.rawSql || '',
    };
  }

  return {
    ...applyQueryDefaults({
      refId: 'SQLVariableQueryEditor-VariableQuery',
      rawSql: rawQuery,
    }),
    query: rawQuery,
  };
}
