import '@formatjs/intl-durationformat/polyfill';
import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { config } from 'app/core/config';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const createDateTimeFormatter = deepMemoize((locale: string, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat(locale, options);
});

const createDurationFormatter = deepMemoize((locale: string, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }

    const locale = config.locale;
    const dateFormatter = createDateTimeFormatter(locale, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const locale = config.locale;

    const dateFormatter = createDurationFormatter(locale, options);
    return dateFormatter.format(duration);
  }
);
