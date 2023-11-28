import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps } from '../types';

export interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  table: string | undefined;
  dataset: string | undefined;
  onChange: (v: SelectableValue) => void;
}

export const TableSelector = ({ db, dataset, table, className, onChange }: TableSelectorProps) => {
  const state = useAsync(async () => {
    // No need to attempt to fetch tables for an unknown dataset.
    if (!dataset) {
      return [];
    }

    const tables = await db.tables(dataset);
    return tables.map(toOption);
  }, [dataset]);

  return (
    <Select
      className={className}
      disabled={state.loading}
      aria-label="Table selector"
      value={table}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={state.loading ? 'Loading tables' : 'Select table'}
    />
  );
};
