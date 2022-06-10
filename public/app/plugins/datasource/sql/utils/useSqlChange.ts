import { useCallback } from 'react';
import { useAsync } from 'react-use';

import { SQLQuery, DB, SQLExpression } from '../types';

import { toRawSql } from './sql.utils';

interface UseSqlChange {
  db: DB;
  query: SQLQuery;
  onQueryChange: (query: SQLQuery) => void;
}

export function useSqlChange({ db, query, onQueryChange }: UseSqlChange) {
  const datasourceId = db.dsID(); // TODO - cleanup
  const { value: init } = useAsync(async () => await db.init(datasourceId), []);

  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      if (!init) {
        return;
      }
      const rawSql = toRawSql({ sql, dataset: query.dataset, table: query.table } as SQLQuery);
      const newQuery: SQLQuery = { ...query, sql, rawSql };
      // newQuery.rawSql = toRawSql(newQuery);  // TODO: since this was a shallow copy is this mutating?
      onQueryChange(newQuery);
    },
    [init, onQueryChange, query]
  );

  return { onSqlChange };
}
