import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { getLanguage } from './i18n';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const createDateTimeFormatter = deepMemoize((locale: string | undefined, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
});

const createDurationFormatter = deepMemoize((locale: string | undefined, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (_value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    const value = typeof _value === 'string' ? new Date(_value) : _value;
    const dateFormatter = createDateTimeFormatter(getLanguage(), format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const dateFormatter = createDurationFormatter(getLanguage(), options);
    return dateFormatter.format(duration);
  }
);

export const formatDateRange = (
  _from: number | Date | string,
  _to: number | Date | string,
  format: Intl.DateTimeFormatOptions = {}
): string => {
  const from = typeof _from === 'string' ? new Date(_from) : _from;
  const to = typeof _to === 'string' ? new Date(_to) : _to;

  const dateFormatter = createDateTimeFormatter(getLanguage(), format);
  return dateFormatter.formatRange(from, to);
};
