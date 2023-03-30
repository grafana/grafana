import React, { useEffect } from 'react';
import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  value: string | null;
  applyDefault?: boolean;
  disabled?: boolean;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ db, value, onChange, disabled, className, applyDefault }: DatasetSelectorProps) => {
  const state = useAsync(async () => {
    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, []);

  const useDefaultDataset = useEffect(() => {
    if (!applyDefault) {
      return;
    }
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
  }, [state.value, value, applyDefault, onChange]);

  return (
    <Select
      className={className}
      aria-label="Dataset selector"
      value={value}
      options={state.value}
      onChange={onChange}
      disabled={true}
      isLoading={state.loading}
      menuShouldPortal={true}
      placeholder={'datamaker'}
    />
  );
};
