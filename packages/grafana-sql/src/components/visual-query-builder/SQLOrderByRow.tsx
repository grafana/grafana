import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { OrderByRow } from './OrderByRow';

type SQLOrderByRowProps = {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
};

export function SQLOrderByRow({ fields, query, onQueryChange, db }: SQLOrderByRowProps) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });
  let columnsWithIndices: SelectableValue[] = [];

  if (fields) {
    const options = query.sql?.columns?.map((c, i) => {
      const value = c.name ? `${c.name}(${c.parameters?.map((p) => p.name)})` : c.parameters?.map((p) => p.name);
      return {
        value,
        label: `${i + 1} - ${value}`,
      };
    });
    columnsWithIndices = [
      {
        value: '',
        label: 'Selected columns',
        options,
        expanded: true,
      },
      ...fields,
    ];
  }

  return <OrderByRow sql={query.sql!} onSqlChange={onSqlChange} columns={columnsWithIndices} />;
}
