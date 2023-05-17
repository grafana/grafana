import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

import { isSqlDatasourceDatabaseSelectionFeatureFlagEnabled } from './QueryEditorFeatureFlag.utils';

export interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | undefined;
  preconfiguredDataset: string;
  isPostgresInstance: boolean | undefined;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({
  dataset,
  db,
  isPostgresInstance,
  onChange,
  preconfiguredDataset,
}: DatasetSelectorProps) => {
  /* 
    The behavior of this component - for MSSQL and MySQL datasources - is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database, this selector
    should only allow that single preconfigured database option to be selected. If the user chose to NOT assign/configure a default database,
    then the user should be able to use this component to choose between multiple databases available to the datasource.
    NOTE: Postgres is NOT configured to be able to connect WITHOUT a default database, so if the datasource is Postgres (isPostgresInstance),
    this component will become disabled.
  */
  // `hasPreconfigCondition` is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres, in which case this component should be disabled by default.
  const hasPreconfigCondition = !!preconfiguredDataset || isPostgresInstance;

  const state = useAsync(async () => {
    if (isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
      // If a default database is already configured for a MSSQL or MySQL data source, OR the data source is Postgres, no need to fetch other databases.
      if (hasPreconfigCondition) {
        return [toOption(preconfiguredDataset)];
      }
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  return (
    <Select
      aria-label="Dataset selector"
      value={dataset}
      options={state.value}
      onChange={onChange}
      disabled={state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
    />
  );
};
