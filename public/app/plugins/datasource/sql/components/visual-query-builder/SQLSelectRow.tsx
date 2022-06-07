import React from 'react';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { useColumns } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { SelectRow } from './SelectRow';

interface SQLSelectRowProps {
  db: DB;
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLSelectRow({ db, query, onQueryChange }: SQLSelectRowProps) {
  const columns = useColumns({ db, query });
  const { onSqlChange } = useSqlChange({ db, query, onQueryChange });

  return <SelectRow columns={columns.value} sql={query.sql} onSqlChange={onSqlChange} />;
}
