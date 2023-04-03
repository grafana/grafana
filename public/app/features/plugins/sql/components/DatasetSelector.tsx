import React, { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  value: string | null;
  preconfiguredDatabase: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, value, onChange, disabled, preconfiguredDatabase }: DatasetSelectorProps) => {
  const databaseIsPreconfigured = !!preconfiguredDatabase.length;

  const state = useAsync(async () => {
    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  useEffect(() => {
    // Set default dataset when values are fetched
    if (!value) {
      if (state.value && state.value[0]) {
        onChange(state.value[0]);
      }
    } else {
      if (state.value && state.value.find((v) => v.value === value) === undefined) {
        // if value is set and newly fetched values does not contain selected value
        if (state.value.length > 0) {
          onChange(state.value[0]);
        }
      }
    }
  }, [state.value, value, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={value}
      options={state.value}
      onChange={onChange}
      disabled={disabled}
      // JEV: fix this logic
      isLoading={!databaseIsPreconfigured || state.loading}
      menuShouldPortal={true}
      // placeholder={databaseIsPreconfigured ? preconfiguredDatabase : }
    />
  );
};
