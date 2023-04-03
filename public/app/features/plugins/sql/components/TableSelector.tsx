import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { Select } from '@grafana/ui';

// import { QueryWithDefaults } from '../defaults';
import { DB, ResourceSelectorProps } from '../types';

interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  chosenTable: string | null;
  chosenDataset: string | undefined;
  onChange: (v: SelectableValue) => void;
}

export const TableSelector = ({ db, chosenDataset, chosenTable, className, onChange }: TableSelectorProps) => {
  const state = useAsync(async () => {
    const tables = await db.tables(chosenDataset);
    return tables.map(toOption);
  }, [chosenDataset]);

  return (
    <Select
      className={className}
      disabled={state.loading}
      aria-label="Table selector"
      value={chosenTable}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={state.loading ? 'Loading tables' : 'Select table'}
    />
  );
};
