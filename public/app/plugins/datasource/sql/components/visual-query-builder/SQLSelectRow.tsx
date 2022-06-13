import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { SQLQuery } from '../../types';
import { useSqlChange } from '../../utils/useSqlChange';

import { SelectRow } from './SelectRow';

interface SQLSelectRowProps {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLSelectRow({ fields, query, onQueryChange }: SQLSelectRowProps) {
  const { onSqlChange } = useSqlChange({ query, onQueryChange });

  return <SelectRow columns={fields} sql={query.sql} onSqlChange={onSqlChange} />;
}
