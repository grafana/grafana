import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { GroupByRow } from './GroupByRow';

interface SQLGroupByRowProps {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
}

export function SQLGroupByRow({ fields, query, onQueryChange, db }: SQLGroupByRowProps) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange, db });

  return <GroupByRow columns={fields} sql={query.sql!} onSqlChange={onSqlChange} />;
}
