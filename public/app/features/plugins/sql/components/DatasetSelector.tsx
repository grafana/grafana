import React from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | null;
  preconfiguredDataset: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, dataset, onChange, preconfiguredDataset }: DatasetSelectorProps) => {
  const usePreconfiguredDataset = !!preconfiguredDataset.length;

  const state = useAsync(async () => {
    // If default database is already configured, no need to fetch other databases.
    if (usePreconfiguredDataset) {
      return [];
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  return (
    <Select
      aria-label="Dataset selector"
      value={usePreconfiguredDataset ? preconfiguredDataset : dataset}
      options={state.value}
      onChange={onChange}
      disabled={usePreconfiguredDataset || state.loading}
      isLoading={usePreconfiguredDataset ? false : state.loading}
      menuShouldPortal={true}
      placeholder={usePreconfiguredDataset ? preconfiguredDataset : 'Select table'}
    />
  );
};
