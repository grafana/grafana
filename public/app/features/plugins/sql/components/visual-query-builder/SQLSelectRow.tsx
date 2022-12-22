import React from 'react';

import { SelectableValue, toOption } from '@grafana/data';

import { COMMON_AGGREGATE_FNS } from '../../constants';
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
  const functions = [...COMMON_AGGREGATE_FNS, ...(db.functions?.() || [])].map(toOption);

  return (
    <SelectRow
      columns={fields}
      sql={query.sql!}
      format={query.format}
      functions={functions}
      onSqlChange={onSqlChange}
    />
  );
}
