import React, { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  chosenDatabase: string;
  preconfiguredDatabase: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, chosenDatabase, onChange, preconfiguredDatabase }: DatasetSelectorProps) => {
  const usePreconfiguredDatabase = !!preconfiguredDatabase.length;

  const state = useAsync(async () => {
    // Early return if database is already configured; no need to fetch other databases.
    if (usePreconfiguredDatabase) {
      return;
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  useEffect(() => {
    // Set default dataset when values are fetched
    if (!chosenDatabase) {
      if (state.value && state.value[0]) {
        onChange(state.value[0]);
      }
    } else {
      if (state.value && state.value.find((v) => v.value === chosenDatabase) === undefined) {
        // if value is set and newly fetched values does not contain selected value
        if (state.value.length > 0) {
          onChange(state.value[0]);
        }
      }
    }
  }, [state.value, chosenDatabase, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={usePreconfiguredDatabase ? preconfiguredDatabase : chosenDatabase}
      options={state.value}
      onChange={onChange}
      disabled={usePreconfiguredDatabase || state.loading}
      isLoading={usePreconfiguredDatabase ? false : state.loading}
      menuShouldPortal={true}
      placeholder={usePreconfiguredDatabase ? preconfiguredDatabase : ''}
    />
  );
};
