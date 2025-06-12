import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { getColumnsWithIndices } from '../../utils/getColumnsWithIndices';
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
  let columnsWithIndices: SelectableValue[] = getColumnsWithIndices(query, fields);
  return <OrderByRow sql={query.sql!} onSqlChange={onSqlChange} columns={columnsWithIndices} />;
}
