import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { SQLExpression, SQLQuery, DB } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';
import { useSqlChange } from '../../utils/useSqlChange';

import { TimeSeriesSelectRow } from './TimeSeriesSelectRow';

interface SQLSelectRowProps {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
  db: DB;
}

export function SQLTimeSeriesSelectRow({ db, fields, query, onQueryChange }: SQLSelectRowProps) {
  let newSql: SQLExpression;

  if (query.sql.columns!.length < 2) {
    newSql = {
      ...query.sql,
      columns: [createFunctionField(), createFunctionField(), createFunctionField()],
    };
  } else {
    newSql = {
      ...query.sql,
      columns: [...query.sql.columns!],
    };
  }

  const { onSqlChange } = useSqlChange({ db, query, onQueryChange });

  return <TimeSeriesSelectRow columns={fields} sql={newSql} onSqlChange={onSqlChange} />;
}
