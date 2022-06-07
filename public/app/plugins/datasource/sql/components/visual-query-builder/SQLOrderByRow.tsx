import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { useColumns } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { OrderByRow } from './OrderByRow';

type SQLOrderByRowProps = {
  db: DB;
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
};

export function SQLOrderByRow({ db, query, onQueryChange }: SQLOrderByRowProps) {
  const columns = useColumns({ db, query, isOrderable: true });
  const { onSqlChange } = useSqlChange({ db, query, onQueryChange });
  let columnsWithIndices: SelectableValue[] = [];

  if (columns.value) {
    columnsWithIndices = [
      {
        value: '',
        label: 'Selected columns',
        options: query.sql.columns?.map((c, i) => ({
          value: i + 1,
          label: c.name
            ? `${i + 1} - ${c.name}(${c.parameters?.map((p) => `${p.name}`)})`
            : c.parameters?.map((p) => `${i + 1} - ${p.name}`),
        })),
        expanded: true,
      },
      ...columns.value,
    ];
  }

  return <OrderByRow sql={query.sql} onSqlChange={onSqlChange} columns={columnsWithIndices} />;
}
