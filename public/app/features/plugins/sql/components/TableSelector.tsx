import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, SQLQuery } from '../types';

interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  value: string | null;
  query: SQLQuery;
  onChange: (v: SelectableValue) => void;
}

export const TableSelector: React.FC<TableSelectorProps> = ({ db, query, value, className, onChange }) => {
  const state = useAsync(async () => {
    if (!query.dataset) {
      return [];
    }
    const tables = await db.tables(query.dataset);
    return tables.map(toOption);
  }, [query.dataset]);

  return (
    <Select
      className={className}
      disabled={state.loading}
      aria-label="Table selector"
      value={value}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={state.loading ? 'Loading tables' : 'Select table'}
    />
  );
};
