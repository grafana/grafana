import { SelectableValue } from '@grafana/data';

import { QueryWithDefaults } from '../../defaults';
import { DB, SQLQuery } from '../../types';
import { getColumnsWithIndices } from '../../utils/getColumnsWithIndices';
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
  let columnsWithIndices: SelectableValue[] = getColumnsWithIndices(query, fields);
  return <GroupByRow columns={columnsWithIndices} sql={query.sql!} onSqlChange={onSqlChange} />;
}
