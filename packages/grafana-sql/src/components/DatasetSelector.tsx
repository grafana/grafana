import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, SQLDialect, toOption } from '../types';

export interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | undefined;
  preconfiguredDataset: string;
  dialect: SQLDialect;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const DatasetSelector = ({
  dataset,
  db,
  dialect,
  onChange,
  inputId,
  preconfiguredDataset,
}: DatasetSelectorProps) => {
  /*
    The behavior of this component is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). For MSSQL and MySQL, if the user configured
    a default database, this selector should only allow that single preconfigured database option to be selected.
    For Postgres, the dataset selector lists schemas within the connected database, so it should always
    fetch available schemas regardless of whether a database is preconfigured.
  */
  // Postgres always fetches schemas (datasets are schemas within the connected database).
  // Other dialects lock to the preconfigured database if one is set.
  const hasPreconfigCondition = dialect !== 'postgres' && !!preconfiguredDataset;

  const state = useAsync(async () => {
    // If a default database is already configured (non-Postgres), no need to fetch other databases.
    if (hasPreconfigCondition) {
      // Set the current database to the preconfigured database.
      onChange(toOption(preconfiguredDataset));
      return [toOption(preconfiguredDataset)];
    }

    // If there is no preconfigured database, but there is a selected dataset, set the current database to the selected dataset.
    if (dataset) {
      onChange(toOption(dataset));
    }

    // Fetch all databases/schemas available to the datasource.
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
