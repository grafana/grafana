import '@formatjs/intl-durationformat/polyfill';
import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { getI18next } from './index';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const createDateTimeFormatter = deepMemoize((language: string, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat(language, options);
});

const createDurationFormatter = deepMemoize((language: string, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(language, options);
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }

    const i18n = getI18next();
    const dateFormatter = createDateTimeFormatter(i18n.language, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const i18n = getI18next();

    const dateFormatter = createDurationFormatter(i18n.language, options);
    return dateFormatter.format(duration);
  }
);
