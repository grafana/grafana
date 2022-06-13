import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { SQLQuery } from '../../types';
// import { useColumns } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { GroupByRow } from './GroupByRow';

interface SQLGroupByRowProps {
  // db: DB;
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLGroupByRow({ fields, query, onQueryChange }: SQLGroupByRowProps) {
  // const columns = useColumns({ db, query, isOrderable: true });
  const { onSqlChange } = useSqlChange({ query, onQueryChange });

  return <GroupByRow columns={fields} sql={query.sql} onSqlChange={onSqlChange} />;
}
