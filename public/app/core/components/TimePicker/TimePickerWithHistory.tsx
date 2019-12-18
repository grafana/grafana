import React from 'react';
import { LocalStorageValueProvider } from '../LocalStorageValueProvider';
import { TimeRange, isDateTime } from '@grafana/data';
import { Props as TimePickerProps, TimePicker } from '@grafana/ui/src/components/TimePicker/TimePicker';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';

interface Props extends Omit<TimePickerProps, 'history' | 'theme'> {}

export const TimePickerWithHistory: React.FC<Props> = props => {
  return (
    <LocalStorageValueProvider<TimeRange[]> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(values, onSaveToStore) => {
        return (
          <TimePicker {...props} history={values} onChange={range => onAppendToHistory(range, values, onSaveToStore)} />
        );
      }}
    </LocalStorageValueProvider>
  );
};

function onAppendToHistory(toAppend: TimeRange, values: TimeRange[], onSaveToStore: (values: TimeRange[]) => void) {
  if (!isAbsolute(toAppend)) {
    return;
  }
  onSaveToStore(limit([...values, toAppend]));
}

function isAbsolute(value: TimeRange): boolean {
  return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}

function limit(value: TimeRange[]): TimeRange[] {
  const start = value.length > 4 ? value.length - 4 : 0;
  return value.splice(start);
}
