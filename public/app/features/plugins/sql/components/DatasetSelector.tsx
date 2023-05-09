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
  hasConfigIssue?: boolean;
}

export const DatasetSelector = ({
  dataset,
  db,
  isPostgresInstance,
  onChange,
  preconfiguredDataset,
  hasConfigIssue,
}: DatasetSelectorProps) => {
  console.log(dataset, 'dataset');
  /* 
    The behavior of this component - for MSSQL and MYSQL datasources - is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database, this selector
    should only allow that single preconfigured database option to be selected. If the user chose to NOT assign/configure a default database,
    then the user should be able to use this component to choose between multiple databases available to the datasource.
    NOTE: Postgres is NOT configured to be able to connect WITHOUT a default database, so if the datasource is Postgres (isPostgresInstance),
    this component will disable.
  */
  // `hasPreconfigCondition` is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres, in which case this component should be disabled by default.
  const hasPreconfigCondition = !!preconfiguredDataset || isPostgresInstance;

  const state = useAsync(async () => {
    // If a default database is already configured for a MSSQL or MYSQL data source, OR the data source is Postgres, no need to fetch other databases.
    if (isSqlDatasourceDatabaseSelectionFeatureFlagEnabled()) {
      if (hasPreconfigCondition) {
        return [toOption(preconfiguredDataset)];
      }
    }

    const datasets = await db.datasets();
    console.log(datasets, 'datasets');
    return datasets.map(toOption);
  }, []);

  // useEffect(() => {
  //   // Set default dataset when values are fetched
  //   if (!dataset) {
  //     if (state.value && state.value[0]) {
  //       onChange(state.value[0]);
  //     }
  //   } else {
  //     if (state.value && state.value.find((v) => v.value === dataset) === undefined) {
  //       // if value is set and newly fetched values does not contain selected value
  //       if (state.value.length > 0) {
  //         onChange(state.value[0]);
  //       }
  //     }
  //   }
  // }, [state.value, dataset, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={dataset}
      options={state.value}
      onChange={onChange}
      disabled={hasConfigIssue || state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
      // placeholder={dataset}
    />
  );
};
