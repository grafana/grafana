import { uniqBy } from 'lodash';

import { AppEvents, DateTime, LocalStorageValueProvider, TimeRange, isDateTime, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TimeRangePickerProps, TimeRangePicker } from '@grafana/ui';
import appEvents from 'app/core/app_events';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
const MAX_HISTORY_ITEMS = 4;

interface Props extends Omit<TimeRangePickerProps, 'history' | 'theme'> {}

// Simplified object to store in local storage
interface TimePickerHistoryItem {
  from: string;
  to: string;
}

export const TimePickerWithHistory = (props: Props) => {
  return (
    <LocalStorageValueProvider<unknown> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(values, onSaveToStore) => {
        const validHistory = getValidHistory(values);
        const history = deserializeHistory(validHistory);

        return (
          <TimeRangePicker
            {...props}
            history={history}
            onChange={(value) => {
              onAppendToHistory(value, validHistory, onSaveToStore);
              props.onChange(value);
            }}
            onError={(error?: string) =>
              appEvents.emit(AppEvents.alertError, [
                t('time-picker.copy-paste.default-error-title', 'Invalid time range'),
                t('time-picker.copy-paste.default-error-message', `{{error}} is not a valid time range`, { error }),
              ])
            }
          />
        );
      }}
    </LocalStorageValueProvider>
  );
};

function getValidHistory(values: unknown): TimePickerHistoryItem[] {
  const result: TimePickerHistoryItem[] = [];

  if (!Array.isArray(values)) {
    return result;
  }
  // Check if the values are already in the correct format

  for (let item of values) {
    const parsed = getValidHistoryItem(item);
    if (parsed) {
      result.push(parsed);
    }
  }

  return result;
}

export function deserializeHistory(values: TimePickerHistoryItem[]): TimeRange[] {
  return values.map((item) => rangeUtil.convertRawToRange(item, 'utc', undefined, 'YYYY-MM-DD HH:mm:ss'));
}

function onAppendToHistory(
  newTimeRange: TimeRange,
  values: TimePickerHistoryItem[],
  onSaveToStore: (values: TimePickerHistoryItem[]) => void
) {
  if (!isAbsoluteTimeRange(newTimeRange)) {
    // If the time range is not absolute, do not append it to history, ex: last 5 minutes
    return;
  }

  // Convert DateTime objects to strings
  const toAppend = {
    from: convertToISOString(newTimeRange.raw.from),
    to: convertToISOString(newTimeRange.raw.to),
  };

  const toStore = limit([toAppend, ...values]);
  onSaveToStore(toStore);
}

function isAbsoluteTimeRange(value: TimeRange): boolean {
  return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}

function limit(value: TimePickerHistoryItem[]): TimePickerHistoryItem[] {
  return uniqBy(value, (v) => v.from + v.to).slice(0, MAX_HISTORY_ITEMS);
}

/**
 * Check if the value is a valid TimePickerHistoryItem. If it doesn't match the format exactly, it will return false.
 * @returns true if the value match exactly to TimePickerHistoryItem, false otherwise
 */
export function getValidHistoryItem(value: unknown): TimePickerHistoryItem | null {
  // First check if it's a valid object
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  // Check if it has exactly two properties
  if (Object.keys(value).length !== 2) {
    return null;
  }

  // Check if it has the required properties
  if (!('from' in value) || !('to' in value)) {
    return null;
  }

  const { from, to } = value;
  // Check if both properties are strings
  if (typeof from === 'string' && typeof to === 'string') {
    return { from, to };
  }

  return null;
}

function convertToISOString(value: DateTime | string): string {
  if (typeof value === 'string') {
    return value;
  }

  if (!value?.toISOString) {
    throw console.error('Invalid DateTime object passed to convertToISOString');
  }

  return value.toISOString();
}
