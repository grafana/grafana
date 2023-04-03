import React, { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  chosenDataset: string | null;
  preconfiguredDatabase: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, chosenDataset, onChange, preconfiguredDatabase }: DatasetSelectorProps) => {
  const databaseIsPreconfigured = !!preconfiguredDatabase.length;

  const state = useAsync(async () => {
    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  useEffect(() => {
    // Set default dataset when values are fetched
    if (!chosenDataset) {
      if (state.value && state.value[0]) {
        onChange(state.value[0]);
      }
    } else {
      if (state.value && state.value.find((v) => v.value === chosenDataset) === undefined) {
        // if value is set and newly fetched values does not contain selected value
        if (state.value.length > 0) {
          onChange(state.value[0]);
        }
      }
    }
  }, [state.value, chosenDataset, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={databaseIsPreconfigured ? preconfiguredDatabase : chosenDataset}
      options={state.value}
      onChange={onChange}
      // JEV: also disable if loading
      disabled={databaseIsPreconfigured}
      // JEV: fix this logic
      isLoading={databaseIsPreconfigured ? false : state.loading}
      menuShouldPortal={true}
      placeholder={databaseIsPreconfigured ? preconfiguredDatabase : ''}
    />
  );
};
