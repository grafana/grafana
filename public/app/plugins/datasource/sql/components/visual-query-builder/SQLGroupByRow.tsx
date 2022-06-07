import React from 'react';

import { QueryWithDefaults } from '../../defaults';
import { SQLQuery, DB } from '../../types';
import { useColumns } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { GroupByRow } from './GroupByRow';

interface SQLGroupByRowProps {
  db: DB;
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLGroupByRow({ db, query, onQueryChange }: SQLGroupByRowProps) {
  const columns = useColumns({ db, query, isOrderable: true });
  const { onSqlChange } = useSqlChange({ db, query, onQueryChange });

  return <GroupByRow columns={columns.value} sql={query.sql} onSqlChange={onSqlChange} />;
}
