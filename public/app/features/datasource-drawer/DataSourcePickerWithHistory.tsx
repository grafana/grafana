import React from 'react';

import { dateTime } from '@grafana/data';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';

import { DataSourcePicker } from './DataSourcePicker';
import { DataSourcePickerHistoryItem, DataSourcePickerWithHistoryProps } from './types';

const DS_PICKER_STORAGE_KEY = 'DATASOURCE_PICKER';

export const DataSourcePickerWithHistory = (props: DataSourcePickerWithHistoryProps) => {
  return (
    <LocalStorageValueProvider<DataSourcePickerHistoryItem[]>
      defaultValue={[]}
      storageKey={props.localStorageKey ?? DS_PICKER_STORAGE_KEY}
    >
      {(rawValues, onSaveToStore) => {
        return (
          <DataSourcePicker
            {...props}
            recentlyUsed={rawValues.map((dsi) => dsi.uid)} //Filter recently to have a time cutoff
            onChange={(ds) => {
              onSaveToStore(updateHistory(rawValues, { uid: ds.uid, lastUse: dateTime(new Date()).toISOString() }));
              props.onChange(ds);
            }}
          ></DataSourcePicker>
        );
      }}
    </LocalStorageValueProvider>
  );
};

export function updateHistory(values: DataSourcePickerHistoryItem[], newValue: DataSourcePickerHistoryItem) {
  const newHistory = values;
  const existingIndex = newHistory.findIndex((dpi) => dpi.uid === newValue.uid);
  if (existingIndex !== -1) {
    newHistory[existingIndex] = newValue;
  } else {
    newHistory.push(newValue);
  }

  newHistory.sort((a, b) => {
    const al = dateTime(a.lastUse);
    const bl = dateTime(b.lastUse);
    if (al.isBefore(bl)) {
      return 1;
    } else if (bl.isBefore(al)) {
      return -1;
    } else {
      return 0;
    }
  });

  return newHistory.slice(0, 3);
}
