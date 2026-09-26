import { useAsync } from 'react-use';

import { type SelectableValue, toOption } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { type DB, type ResourceSelectorProps } from '../types';

export interface TableSelectorProps extends ResourceSelectorProps {
  db: DB;
  table: string | undefined;
  dataset: string | undefined;
  database?: string | undefined;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const TableSelector = ({ db, dataset, database, table, className, onChange, inputId }: TableSelectorProps) => {
  const state = useAsync(async () => {
    // No need to attempt to fetch tables for an unknown dataset.
    if (!dataset) {
      return [];
    }

    const tables = await db.tables(dataset, database);
    return tables.map(toOption);
  }, [dataset, database]);

  return (
    <Select
      className={className}
      disabled={state.loading}
      aria-label={t('grafana-sql.components.table-selector.aria-label-table-selector', 'Table selector')}
      inputId={inputId}
      data-testid={selectors.components.SQLQueryEditor.headerTableSelector}
      value={table ?? null}
      options={state.value}
      onChange={onChange}
      isLoading={state.loading}
      menuShouldPortal={true}
      isClearable={true}
      placeholder={
        state.loading
          ? t('grafana-sql.components.table-selector.placeholder-loading', 'Loading tables')
          : t('grafana-sql.components.table-selector.placeholder-select-table', 'Select table')
      }
      allowCustomValue={true}
    />
  );
};
