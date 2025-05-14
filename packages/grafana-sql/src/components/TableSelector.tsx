import { useAsync } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps } from '../types';

export interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  table: string | undefined;
  dataset: string | undefined;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const TableSelector = ({ db, dataset, table, className, onChange, inputId }: TableSelectorProps) => {
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
      inputId={inputId}
      data-testid={selectors.components.SQLQueryEditor.headerTableSelector}
      value={table}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={state.loading ? 'Loading tables' : 'Select table'}
    />
  );
};
