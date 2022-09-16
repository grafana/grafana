import { t } from '@lingui/macro';
import React from 'react';

import { TimeRange, isDateTime, toUtc } from '@grafana/data';
import { TimeRangePickerProps, TimeRangePicker } from '@grafana/ui';

import { LocalStorageValueProvider } from '../LocalStorageValueProvider';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';

interface Props extends Omit<TimeRangePickerProps, 'history' | 'theme' | 'timePickerTitles'> {}

const timePickerContentTitle = t({
  id: 'dashboard.time-picker-content.title',
  message: `Absolute time range`,
});

const timeRangeListTitle = t({
  id: 'dashboard.time-range-list.title',
  message: `Recently used absolute ranges`,
});

const calendarHeaderTitle = t({
  id: 'dashboard.calendar-header-title.title',
  message: `Select a time range`,
});

export const timePickerTitles = {
  timePickerContentTitle,
  timeRangeListTitle,
  calendarHeaderTitle,
};

export const TimePickerWithHistory = (props: Props) => {
  return (
    <LocalStorageValueProvider<TimeRange[]> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(values, onSaveToStore) => {
        return (
          <TimeRangePicker
            {...props}
            timePickerTitles={timePickerTitles}
            history={convertIfJson(values)}
            onChange={(value) => {
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
  return history.map((time) => {
    if (isDateTime(time.from)) {
      return time;
    }

    return {
      from: toUtc(time.from),
      to: toUtc(time.to),
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
