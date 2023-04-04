import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | null;
  preconfiguredDataset: string;
  isDatasetSelectorHidden: boolean | undefined;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({
  db,
  dataset,
  onChange,
  preconfiguredDataset,
  isDatasetSelectorHidden,
}: DatasetSelectorProps) => {
  const usePreconfiguredDataset = !!preconfiguredDataset.length;
  // This condition is true if either 1) the sql datasource has a preconfigured default database,
  // OR if 2) the datasource is Postgres, in which case this component should be disabled by default.
  const hasTruthyCondition = usePreconfiguredDataset || isDatasetSelectorHidden;

  const state = useAsync(async () => {
    // If default database is already configured, OR is unconfigured in a Postgres config, no need to fetch other databases.
    if (hasTruthyCondition) {
      return [];
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  const determinePlaceholder = () => {
    return usePreconfiguredDataset
      ? preconfiguredDataset
      : isDatasetSelectorHidden
      ? 'Unconfigured database'
      : 'Select table';
  };

  return (
    <Select
      aria-label="Dataset selector"
      value={usePreconfiguredDataset ? preconfiguredDataset : dataset}
      options={state.value}
      onChange={onChange}
      disabled={hasTruthyCondition || state.loading}
      isLoading={hasTruthyCondition ? false : state.loading}
      menuShouldPortal={true}
      placeholder={determinePlaceholder()}
    />
  );
};
