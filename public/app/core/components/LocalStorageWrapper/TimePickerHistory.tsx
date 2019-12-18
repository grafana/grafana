import React, { PureComponent } from 'react';
import { LocalStorageWrapper } from './';
import { TimeRange, isDateTime } from '@grafana/data';

const localStorageKey = 'grafana.dashboard.timepicker.history';

interface Props {
  children: (value: TimeRange[], onChange: (value: TimeRange) => void) => React.ReactNode;
}

export default class TimePickerWrapper extends PureComponent<Props> {
  onAppendToHistory = (toAppend: TimeRange, values: TimeRange[], onSaveToStore: (values: TimeRange[]) => void) => {
    if (!isAbsolute(toAppend)) {
      return;
    }
    onSaveToStore(limit([...values, toAppend]));
  };

  render() {
    const { children } = this.props;

    return (
      <LocalStorageWrapper<TimeRange[]> storeAtKey={localStorageKey} defaultValue={[]}>
        {(values, onSaveToStore) => {
          return children(values, value => this.onAppendToHistory(value, values, onSaveToStore));
        }}
      </LocalStorageWrapper>
    );
  }
}

function isAbsolute(value: TimeRange): boolean {
  return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}

function limit(value: TimeRange[]): TimeRange[] {
  const start = value.length > 4 ? value.length - 4 : 0;
  console.log('start', start);
  return value.splice(start);
}
