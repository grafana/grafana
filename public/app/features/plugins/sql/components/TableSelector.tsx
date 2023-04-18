import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps } from '../types';

interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  table: string | undefined;
  dataset: string | undefined;
  onChange: (v: SelectableValue) => void;
  cascadeDisable?: boolean;
}

export const TableSelector = ({ db, dataset, table, className, onChange, cascadeDisable }: TableSelectorProps) => {
  console.log(table, 'table');
  const state = useAsync(async () => {
    if (!dataset) {
      return [];
    }

    const tables = await db.tables(dataset);
    return tables.map(toOption);
  }, [dataset]);

  return (
    <Select
      className={className}
      disabled={state.loading || cascadeDisable}
      aria-label="Table selector"
      value={table}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={state.loading ? 'Loading tables' : table}
    />
  );
};
