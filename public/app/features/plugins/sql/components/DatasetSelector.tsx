import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | null;
  preconfiguredDataset: string;
  disableDatasetSelector: boolean | undefined;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({
  db,
  dataset,
  onChange,
  preconfiguredDataset,
  disableDatasetSelector,
}: DatasetSelectorProps) => {
  /* 
    The behavior of this component - for MsSql and MySql datasources - is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database, this selector should be disabled,
    and defacto assigned the value of the configured default database. If the user chose to NOT assign/configure a default database,
    then the user should be able to use this component to chose between multiple databases available to the datasource.
    NOTE: Postgres is NOT configured to be able to do this, so if the datasource is Postgres (disableDatasetSelector),
    and no default dataset has been configured, this component will also become disabled.
  */

  const usePreconfiguredDataset = !!preconfiguredDataset.length;
  // This condition is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres, in which case this component should be disabled by default.
  const hasPreconfigCondition = usePreconfiguredDataset || disableDatasetSelector;

  const state = useAsync(async () => {
    // If default database is already configured in MySql or MsSql, OR is unconfigured in Postgres, no need to fetch other databases.
    if (hasPreconfigCondition) {
      return [];
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  const determinePlaceholder = () => {
    return usePreconfiguredDataset
      ? preconfiguredDataset
      : disableDatasetSelector
      ? 'Unconfigured database'
      : 'Select table';
  };

  return (
    <Select
      aria-label="Dataset selector"
      value={usePreconfiguredDataset ? preconfiguredDataset : dataset}
      options={state.value}
      onChange={onChange}
      disabled={hasPreconfigCondition || state.loading}
      isLoading={hasPreconfigCondition ? false : state.loading}
      menuShouldPortal={true}
      placeholder={determinePlaceholder()}
    />
  );
};
