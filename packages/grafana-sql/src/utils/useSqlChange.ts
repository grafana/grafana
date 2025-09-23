import { useCallback } from 'react';

import { DB, SQLExpression, SQLQuery } from '../types';

interface UseSqlChange {
  db: DB;
  query: SQLQuery;
  onQueryChange: (query: SQLQuery) => void;
}

export function useSqlChange({ query, onQueryChange, db }: UseSqlChange) {
  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      const toRawSql = db.toRawSql;
      const rawSql = toRawSql({ sql, dataset: query.dataset, table: query.table, refId: query.refId });
      const newQuery: SQLQuery = { ...query, sql, rawSql };
      onQueryChange(newQuery);
    },
    [db, onQueryChange, query]
  );

  return { onSqlChange };
}
