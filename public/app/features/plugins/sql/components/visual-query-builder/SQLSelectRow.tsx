import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { SelectRow } from './SelectRow';

interface SQLSelectRowProps {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
}

export function SQLSelectRow({ fields, query, onQueryChange, db }: SQLSelectRowProps) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return <SelectRow columns={fields} sql={query.sql!} onSqlChange={onSqlChange} />;
}
