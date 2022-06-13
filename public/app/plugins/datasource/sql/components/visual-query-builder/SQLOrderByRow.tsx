import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { SQLQuery } from '../../types';
// import { useColumns } from '../../utils/useColumns';
import { useSqlChange } from '../../utils/useSqlChange';

import { OrderByRow } from './OrderByRow';

type SQLOrderByRowProps = {
  // db: DB;
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
};

export function SQLOrderByRow({ fields, query, onQueryChange }: SQLOrderByRowProps) {
  // const columns = useColumns({ query, isOrderable: true });
  const { onSqlChange } = useSqlChange({ query, onQueryChange });
  let columnsWithIndices: SelectableValue[] = [];

  if (fields) {
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
      ...fields,
    ];
  }

  return <OrderByRow sql={query.sql} onSqlChange={onSqlChange} columns={columnsWithIndices} />;
}
