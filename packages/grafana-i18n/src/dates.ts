import deepEqual from 'fast-deep-equal';
import { memoize } from 'micro-memoize';

import { getLanguage } from './i18n';

const deepOptions = { isKeyItemEqual: deepEqual };

const createDateTimeFormatter = memoize((locale: string | undefined, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
}, deepOptions);

const createDurationFormatter = memoize((locale: string | undefined, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
}, deepOptions);

const createRelativeTimeFormatter = memoize((locale: string | undefined, options: Intl.RelativeTimeFormatOptions) => {
  try {
    return new Intl.RelativeTimeFormat(locale, options);
  } catch {
    return new Intl.RelativeTimeFormat('en-US', options);
  }
}, deepOptions);

export const formatDate = memoize((_value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
  const value = typeof _value === 'string' ? new Date(_value) : _value;
  const dateFormatter = createDateTimeFormatter(getLanguage(), format);
  return dateFormatter.format(value);
}, deepOptions);

export const formatDuration = memoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const dateFormatter = createDurationFormatter(getLanguage(), options);
    return dateFormatter.format(duration);
  },
  deepOptions
);

/**
 * `formatRelativeTime(-11, 'minute', { style: 'narrow' })` → `11m ago` in the current language.
 * @alpha
 */
export const formatRelativeTime = memoize(
  (value: number, unit: Intl.RelativeTimeFormatUnit, options: Intl.RelativeTimeFormatOptions = {}): string => {
    return createRelativeTimeFormatter(getLanguage(), options).format(value, unit);
  },
  deepOptions
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
