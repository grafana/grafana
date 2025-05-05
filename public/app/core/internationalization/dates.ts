import '@formatjs/intl-durationformat/polyfill';
import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { config } from 'app/core/config';

import { getI18next } from './index';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const isLocaleEnabled = config.featureToggles.localeFormatPreference;

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

    const i18n = getI18next();
    const currentLocale = isLocaleEnabled ? config.locale : i18n.language;

    const dateFormatter = createDateTimeFormatter(currentLocale, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const i18n = getI18next();
    const currentLocale = isLocaleEnabled ? config.locale : i18n.language;

    const dateFormatter = createDurationFormatter(currentLocale, options);
    return dateFormatter.format(duration);
  }
);
