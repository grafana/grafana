import { uniqBy } from 'lodash';

import { AppEvents, TimeRange, isDateTime, rangeUtil } from '@grafana/data';
import { useTranslate } from '@grafana/i18n';
import { TimeRangePickerProps, TimeRangePicker } from '@grafana/ui';
import appEvents from 'app/core/app_events';

import { LocalStorageValueProvider } from '../LocalStorageValueProvider';

const LOCAL_STORAGE_KEY = 'grafana.dashboard.timepicker.history';

interface Props extends Omit<TimeRangePickerProps, 'history' | 'theme'> {}

// Simplified object to store in local storage
interface TimePickerHistoryItem {
  from: string;
  to: string;
}

// We should only be storing TimePickerHistoryItem, but in the past we also stored TimeRange
export type LSTimePickerHistoryItem = TimePickerHistoryItem | TimeRange;

export const TimePickerWithHistory = (props: Props) => {
  const { t } = useTranslate();

  return (
    <LocalStorageValueProvider<LSTimePickerHistoryItem[]> storageKey={LOCAL_STORAGE_KEY} defaultValue={[]}>
      {(rawValues, onSaveToStore) => {
        const values = migrateHistory(rawValues);
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

function deserializeHistory(values: TimePickerHistoryItem[]): TimeRange[] {
  // The history is saved in UTC and with the default date format, so we need to pass those values to the convertRawToRange
  return values.map((item) => rangeUtil.convertRawToRange(item, 'utc', undefined, 'YYYY-MM-DD HH:mm:ss'));
}

/**
 * Migrates/reformat history items to the current format
 * @param values - Array of history items to clean up
 * @returns Array of formatted history items
 */
export function migrateHistory(values: LSTimePickerHistoryItem[]): TimePickerHistoryItem[] {
  return values
    .filter(isValidTimePickerValue) // Filter out invalid values
    .map((item) => {
      const fromValue = typeof item.from === 'string' ? item.from : item.from.toISOString();
      const toValue = typeof item.to === 'string' ? item.to : item.to.toISOString();

      return {
        from: fromValue,
        to: toValue,
      };
    });
}

function onAppendToHistory(
  newTimeRange: TimeRange,
  values: TimePickerHistoryItem[],
  onSaveToStore: (values: TimePickerHistoryItem[]) => void
) {
  if (!isAbsolute(newTimeRange)) {
    return;
  }

  // Convert DateTime objects to strings
  const toAppend = {
    from: typeof newTimeRange.raw.from === 'string' ? newTimeRange.raw.from : newTimeRange.raw.from.toISOString(),
    to: typeof newTimeRange.raw.to === 'string' ? newTimeRange.raw.to : newTimeRange.raw.to.toISOString(),
  };

  const toStore = limit([toAppend, ...values]);
  onSaveToStore(toStore);
}

function isAbsolute(value: TimeRange): boolean {
  return isDateTime(value.raw.from) || isDateTime(value.raw.to);
}

function limit(value: TimePickerHistoryItem[]): TimePickerHistoryItem[] {
  return uniqBy(value, (v) => v.from + v.to).slice(0, 4);
}

/**
 * Type guard to check if a value is a valid time picker history item
 * @returns True if the value is a valid time picker history item
 */
export function isValidTimePickerValue(value: unknown): value is LSTimePickerHistoryItem {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if ('from' in value && 'to' in value) {
    // Check if value object has both from and to properties
    return !!value.from && !!value.to; // Check if both from and to are not null or undefined
  }

  return false;
}
