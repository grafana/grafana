import React from 'react';

import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { SQLExpression, SQLQuery } from '../../types';
import { createFunctionField } from '../../utils/sql.utils';
import { useSqlChange } from '../../utils/useSqlChange';

import { TimeSeriesSelectRow } from './TimeSeriesSelectRow';

interface SQLSelectRowProps {
  fields: SelectableValue[];
  query: QueryWithDefaults;
  onQueryChange: (query: SQLQuery) => void;
}

export function SQLTimeSeriesSelectRow({ fields, query, onQueryChange }: SQLSelectRowProps) {
  const newSql: SQLExpression = {
    ...query.sql,
    columns: [...query.sql.columns!, createFunctionField('value'), createFunctionField('metric')],
  };
  const { onSqlChange } = useSqlChange({ query, onQueryChange });

  return <TimeSeriesSelectRow columns={fields} sql={newSql} onSqlChange={onSqlChange} />;
}
