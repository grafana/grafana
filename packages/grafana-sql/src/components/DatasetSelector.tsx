import { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, SQLDialect, toOption } from '../types';

import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './QueryEditorFeatureFlag.utils';

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
    The behavior of this component - for MSSQL and MySQL datasources - is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database, this selector
    should only allow that single preconfigured database option to be selected. If the user chose to NOT assign/configure a default database,
    then the user should be able to use this component to choose between multiple databases available to the datasource.
  */
  // `hasPreconfigCondition` is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres. In either case the only option available to the user is the preconfigured database.
  const hasPreconfigCondition = !!preconfiguredDataset || dialect === 'postgres';

  const state = useAsync(async () => {
    if (isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
      // If a default database is already configured for a MSSQL or MySQL data source, OR the data source is Postgres, no need to fetch other databases.
      if (hasPreconfigCondition) {
        // Set the current database to the preconfigured database.
        onChange(toOption(preconfiguredDataset));
        return [toOption(preconfiguredDataset)];
      }
    }

    // If there is no preconfigured database, but there is a selected dataset, set the current database to the selected dataset.
    if (dataset) {
      onChange(toOption(dataset));
    }

    // Otherwise, fetch all databases available to the datasource.
    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  useEffect(() => {
    if (!isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
      // Set default dataset when values are fetched
      if (!dataset) {
        if (state.value && state.value[0]) {
          onChange(state.value[0]);
        }
      } else {
        if (state.value && state.value.find((v) => v.value === dataset) === undefined) {
          // if value is set and newly fetched values does not contain selected value
          if (state.value.length > 0) {
            onChange(state.value[0]);
          }
        }
      }
    }
  }, [state.value, onChange, dataset]);

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
