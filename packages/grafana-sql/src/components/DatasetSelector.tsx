import { useAsync } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { type DB, type ResourceSelectorProps, type SQLDialect, toOption } from '../types';

export interface DatasetSelectorProps extends ResourceSelectorProps {
  db: Pick<DB, 'datasets'>;
  mode?: 'select' | 'fixed';
  dataset: string | undefined;
  preconfiguredDataset: string;
  dialect: SQLDialect;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const DatasetSelector = ({
  dataset,
  db,
  mode,
  dialect,
  onChange,
  inputId,
  preconfiguredDataset,
}: DatasetSelectorProps) => {
  // An explicit mode decouples dataset selection from the dialect. Otherwise retain
  // the legacy single-database behavior for configured databases and PostgreSQL.
  const hasPreconfigCondition = mode ? mode === 'fixed' : !!preconfiguredDataset || dialect === 'postgres';

  const state = useAsync(async () => {
    // Fixed datasets do not need to enumerate other databases.
    if (hasPreconfigCondition) {
      // Set the current database to the preconfigured database.
      onChange(toOption(preconfiguredDataset));
      return [toOption(preconfiguredDataset)];
    }

    // If there is no preconfigured database, but there is a selected dataset, set the current database to the selected dataset.
    if (dataset) {
      onChange(toOption(dataset));
    }

    // Otherwise, fetch all databases available to the datasource.
    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  return (
    <Select
      aria-label={t('grafana-sql.components.dataset-selector.aria-label-dataset-selector', 'Dataset selector')}
      inputId={inputId}
      value={dataset}
      options={state.value}
      onChange={onChange}
      disabled={state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
    />
  );
};
