import { useCallback } from 'react';

import { DB, SQLExpression, SQLQuery } from '../types';

import { defaultToRawSql } from './sql.utils';

interface UseSqlChange {
  db: DB;
  query: SQLQuery;
  onQueryChange: (query: SQLQuery) => void;
}

export function useSqlChange({ query, onQueryChange, db }: UseSqlChange) {
  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      const toRawSql = db.toRawSql || defaultToRawSql;
      const q: Partial<SQLQuery> = { sql, dataset: query.dataset, table: query.table };
      const rawSql = toRawSql(q);
      const newQuery: SQLQuery = { ...query, sql, rawSql };
      onQueryChange(newQuery);
    },
    [db, onQueryChange, query]
  );

  return { onSqlChange };
}
