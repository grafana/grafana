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
  const { value: apiClient } = useAsync(async () => await db.init(datasourceId), []);

  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      if (!apiClient) {
        return;
      }
      const newQuery: SQLQuery = { ...query, sql };
      newQuery.rawSql = toRawSql(newQuery);
      onQueryChange(newQuery);
    },
    [apiClient, onQueryChange, query]
  );

  return { onSqlChange };
}
