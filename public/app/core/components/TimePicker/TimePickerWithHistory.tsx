import React from 'react';
import { LocalStorageValueProvider } from '../LocalStorageValueProvider';
import { TimeRange, isDateTime, dateTime } from '@grafana/data';
import { Props as TimePickerProps, TimePicker } from '@grafana/ui/src/components/TimePicker/TimePicker';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';

interface Props extends Omit<TimePickerProps, 'history' | 'theme'> {}

export const TimePickerWithHistory: React.FC<Props> = props => {
  return (
    <LocalStorageValueProvider<TimeRange[]> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(values, onSaveToStore) => {
        return (
          <TimePicker
            {...props}
            history={convertIfJson(values)}
            onChange={value => {
              onAppendToHistory(value, values, onSaveToStore);
              props.onChange(value);
            }}
          />
        );
      }}
    </LocalStorageValueProvider>
  );
};

function convertIfJson(history: TimeRange[]): TimeRange[] {
  return history.map(time => {
    if (isDateTime(time.from)) {
      return time;
    }

    return {
      from: dateTime(time.from),
      to: dateTime(time.to),
      raw: time.raw,
    };
  });
}

function onAppendToHistory(toAppend: TimeRange, values: TimeRange[], onSaveToStore: (values: TimeRange[]) => void) {
  if (!isAbsolute(toAppend)) {
    return;
  }
  const toStore = limit([toAppend, ...values]);
  onSaveToStore(toStore);
}

function isAbsolute(value: TimeRange): boolean {
  return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}

function limit(value: TimeRange[]): TimeRange[] {
  return value.slice(0, 4);
}
