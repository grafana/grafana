import React from 'react';

import { SelectableValue } from '@grafana/data';

import { DB, SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { GroupByRow } from './GroupByRow';

interface SQLGroupByRowProps<T extends SQLQuery> {
  fields: SelectableValue[];
  query: T;
  onQueryChange: (query: T) => void;
  db: DB;
}

export function SQLGroupByRow<T extends SQLQuery>({ fields, query, onQueryChange, db }: SQLGroupByRowProps<T>) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return <GroupByRow columns={fields} sql={query.sql || {}} onSqlChange={onSqlChange} />;
}
