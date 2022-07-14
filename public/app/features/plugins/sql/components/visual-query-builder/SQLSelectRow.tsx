import React from 'react';

import { SelectableValue } from '@grafana/data';

import { DB, SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { SelectRow } from './SelectRow';

interface SQLSelectRowProps<T extends SQLQuery> {
  fields: SelectableValue[];
  query: T;
  onQueryChange: (query: T) => void;
  db: DB;
}

export function SQLSelectRow<T extends SQLQuery>({ fields, query, onQueryChange, db }: SQLSelectRowProps<T>) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return <SelectRow columns={fields} sql={query.sql || {}} onSqlChange={onSqlChange} />;
}
