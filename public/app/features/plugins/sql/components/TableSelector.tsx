import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { QueryWithDefaults } from '../defaults';
import { DB, ResourceSelectorProps } from '../types';

interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  value: string | null;
  query: QueryWithDefaults;
  onChange: (v: SelectableValue) => void;
  forceFetch?: boolean;
}

export const TableSelector = ({ db, query, value, className, onChange, forceFetch }: TableSelectorProps) => {
  const state = useAsync(async () => {
    if (!query.dataset && !forceFetch) {
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
