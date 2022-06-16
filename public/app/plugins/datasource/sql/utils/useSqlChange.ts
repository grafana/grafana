import { useCallback } from 'react';

import { DB, SQLExpression, SQLQuery } from '../types';

import { defaultToRawSql } from './sql.utils';

interface UseSqlChange {
  db: DB;
  query: SQLQuery;
  onQueryChange: (query: SQLQuery) => void;
}

export function useSqlChange({ query, onQueryChange, db }: UseSqlChange) {
  // TODO: the db initilizes now on the datasource constructor - probably don't need this
  // const datasourceId = db.dsID(); // TODO - cleanup
  // const { value: init } = useAsync(async () => await db.init(datasourceId), []);

  const onSqlChange = useCallback(
    (sql: SQLExpression) => {
      // if (!init) {
      //   return;
      // }
      const toRawSql = db.toRawSql || defaultToRawSql;
      const rawSql = toRawSql({ sql, dataset: query.dataset, table: query.table, refId: db.dsID() });
      const newQuery: SQLQuery = { ...query, sql, rawSql };
      // newQuery.rawSql = toRawSql(newQuery);  // TODO: since this was a shallow copy is this mutating?
      onQueryChange(newQuery);
    },
    [db, onQueryChange, query]
  );

  return { onSqlChange };
}
