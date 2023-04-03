import React, { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string;
  preconfiguredDataset: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, dataset, onChange, preconfiguredDataset }: DatasetSelectorProps) => {
  const usePreconfiguredDataset = !!preconfiguredDataset.length;

  const state = useAsync(async () => {
    // Early return if database is already configured; no need to fetch other databases.
    if (usePreconfiguredDataset) {
      return;
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  useEffect(() => {
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
  }, [state.value, dataset, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={usePreconfiguredDataset ? preconfiguredDataset : dataset}
      options={state.value}
      onChange={onChange}
      disabled={usePreconfiguredDataset || state.loading}
      isLoading={usePreconfiguredDataset ? false : state.loading}
      menuShouldPortal={true}
      placeholder={usePreconfiguredDataset ? preconfiguredDataset : ''}
    />
  );
};
