import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

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
    The behavior of this component - for MSSQL and MYSQL datasources - is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database, this selector should be disabled,
    and defacto assigned the value of the configured default database. If the user chose to NOT assign/configure a default database,
    then the user should be able to use this component to choose between multiple databases available to the datasource.
    NOTE: Postgres is NOT configured to be able to connect WITHOUT a default database, so if the datasource is Postgres (isPostgresInstance),
    this component will also become disabled.
  */
  const sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled = config.featureToggles.sqlDatasourceDatabaseSelection;
  const usePreconfiguredDataset = !!preconfiguredDataset;
  // `hasPreconfigCondition` is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres, in which case this component should be disabled by default.
  const hasPreconfigCondition = usePreconfiguredDataset || isPostgresInstance;

  const state = useAsync(async () => {
    // If a default database is already configured for a MSSQL or MYSQL data source, OR the data source is Postgres, no need to fetch other databases.
    if (sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled) {
      if (hasPreconfigCondition) {
        return [];
      }
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  const determinePlaceholder = () => {
    if (usePreconfiguredDataset) {
      return preconfiguredDataset;
    }

    // This will only be true of unconfigured Postgres data sources,
    // since configured Postgres data sources will be caught by the previous condition.
    if (isPostgresInstance) {
      return 'Unconfigured database';
    }

    // This will only be true for unconfigured (no default database) MSSQL/MYSQL data sources.
    if (!dataset) {
      return 'Select table';
    }

    return dataset;
  };

  return (
    <Select
      aria-label="Dataset selector"
      value={dataset}
      options={state.value}
      onChange={onChange}
      disabled={
        sqlDatasourceDatabaseSelectionFeatureFlagIsEnabled ? hasPreconfigCondition || state.loading : state.loading
      }
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={determinePlaceholder()}
    />
  );
};
