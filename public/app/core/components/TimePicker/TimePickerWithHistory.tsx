import { uniqBy } from 'lodash';

import { AppEvents, DateTime, TimeRange, isDateTime, rangeUtil } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { TimeRangePickerProps, TimeRangePicker } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { LocalStorageValueProvider } from '../LocalStorageValueProvider';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';
const MAX_HISTORY_ITEMS = 4;

interface Props extends Omit<TimeRangePickerProps, 'history' | 'theme'> {}

// Simplified object to store in local storage
interface TimePickerHistoryItem {
  from: string;
  to: string;
}

export const TimePickerWithHistory = (props: Props) => {
  const { t } = useTranslate();

  return (
    <LocalStorageValueProvider<TimePickerHistoryItem[]> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(values, onSaveToStore) => {
        const history = deserializeHistory(values);

        return (
          <TimeRangePicker
            {...props}
            history={history}
            onChange={(value) => {
              onAppendToHistory(value, values, onSaveToStore);
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

export function deserializeHistory(values: unknown[]): TimeRange[] {
  return values
    .filter(isValidTimePickerHistoryValue) // Filter out invalid values
    .map((item) => rangeUtil.convertRawToRange(item, 'utc', undefined, 'YYYY-MM-DD HH:mm:ss'));
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
    from: typeof newTimeRange.raw.from === 'string' ? newTimeRange.raw.from : convertToISOString(newTimeRange.raw.from),
    to: typeof newTimeRange.raw.to === 'string' ? newTimeRange.raw.to : convertToISOString(newTimeRange.raw.to),
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
export function isValidTimePickerHistoryValue(value: unknown): value is TimePickerHistoryItem {
  // First check if it's a valid object
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  // Check if it has exactly two properties
  if (Object.keys(value).length !== 2) {
    return false;
  }

  // Check if it has the required properties
  if (!('from' in value) || !('to' in value)) {
    return false;
  }

  // Check if both properties are strings
  return typeof value.from === 'string' && typeof value.to === 'string';
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
