import { useCallback } from 'react';

import { DB, SQLExpression, SQLQuery } from '../types';

import { defaultToRawSql } from './sql.utils';

interface UseSqlChange<T extends SQLQuery> {
  db: DB;
  query: T;
  onQueryChange: (query: T) => void;
}

export function useSqlChange<T extends SQLQuery>({ query, onQueryChange, db }: UseSqlChange<T>) {
  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      const toRawSql = db.toRawSql || defaultToRawSql;
      const rawSql = toRawSql({ sql, dataset: query.dataset, table: query.table, refId: query.refId });
      const newQuery: T = { ...query, sql, rawSql };
      onQueryChange(newQuery);
    },
    [db, onQueryChange, query]
  );

  return { onSqlChange };
}
