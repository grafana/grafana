import { useId } from 'react';

import { t } from '@grafana/i18n';
import { EditorField, EditorRow } from '@grafana/plugin-ui';

import { type DB, type SQLQuery } from '../types';

import { DatasetSelector } from './DatasetSelector';
import { TableSelector } from './TableSelector';

export type SQLDatasetSelector =
  | { mode: 'select'; label?: string }
  | { mode: 'fixed'; value: string; label?: string }
  | { mode: 'hidden'; value?: string };

export interface SqlQueryBuilderSelectorsProps {
  db: Pick<DB, 'datasets' | 'tables'>;
  query: SQLQuery;
  onChange: (query: SQLQuery) => void;
  dataset?: SQLDatasetSelector;
}

export function SqlQueryBuilderSelectors({
  db,
  query,
  onChange,
  dataset = { mode: 'select' },
}: SqlQueryBuilderSelectorsProps) {
  const id = useId();
  const fixedDataset = dataset.mode === 'select' ? '' : (dataset.value ?? '');

  return (
    <EditorRow>
      {dataset.mode !== 'hidden' && (
        <EditorField
          label={dataset.label ?? t('grafana-sql.components.query-header.label-dataset', 'Dataset')}
          width={25}
        >
          <DatasetSelector
            db={db}
            inputId={`sql-dataset-${id}`}
            dataset={query.dataset}
            dialect="other"
            mode={dataset.mode}
            preconfiguredDataset={fixedDataset}
            onChange={({ value }) => {
              if (value !== query.dataset) {
                if (dataset.mode === 'fixed' && !query.dataset) {
                  onChange({ ...query, dataset: value });
                } else {
                  onChange({ ...query, dataset: value, table: undefined, sql: undefined, rawSql: '' });
                }
              }
            }}
          />
        </EditorField>
      )}
      <EditorField label={t('grafana-sql.components.query-header.label-table', 'Table')} width={25}>
        <TableSelector
          db={db}
          inputId={`sql-tableselect-${id}`}
          dataset={query.dataset || fixedDataset}
          table={query.table}
          onChange={({ value }) => {
            if (value !== query.table) {
              onChange({ ...query, table: value, sql: undefined, rawSql: '' });
            }
          }}
        />
      </EditorField>
    </EditorRow>
  );
}
