import React from 'react';
// import { useAsync } from 'react-use';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { DB, ResourceSelectorProps, toOption } from '../types';

interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  defaultDatabase: string;
  onChange: (v: SelectableValue) => void;
}

export const DatasetSelector = ({ defaultDatabase, onChange }: DatasetSelectorProps) => {
  // const state = useAsync(async () => {
  //   const datasets = await db.datasets();
  //   return datasets.map(toOption);
  // }, []);

  // const useDefaultDataset = useEffect(() => {
  //   if (!applyDefault) {
  //     return;
  //   }
  //   // Set default dataset when values are fetched
  //   if (!value) {
  //     if (state.value && state.value[0]) {
  //       onChange(state.value[0]);
  //     }
  //   } else {
  //     if (state.value && state.value.find((v) => v.value === value) === undefined) {
  //       // if value is set and newly fetched values does not contain selected value
  //       if (state.value.length > 0) {
  //         onChange(state.value[0]);
  //       }
  //     }
  //   }
  // }, [state.value, value, applyDefault, onChange]);

  return (
    <Select
      aria-label="Dataset selector"
      value={toOption(defaultDatabase)}
      disabled={true}
      onChange={onChange}
      menuShouldPortal={true}
      placeholder={defaultDatabase}
    />
  );
};
