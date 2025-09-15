import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { getLanguage } from '@grafana/i18n/internal';
import { config } from 'app/core/config';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const isLocaleEnabled = config.featureToggles.localeFormatPreference;

const createDateTimeFormatter = deepMemoize((locale: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
});

const createDurationFormatter = deepMemoize((locale: string, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }

    const currentLocale = isLocaleEnabled ? config.regionalFormat : getLanguage();

    const dateFormatter = createDateTimeFormatter(currentLocale, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const currentLocale = isLocaleEnabled ? config.regionalFormat : getLanguage();

    const dateFormatter = createDurationFormatter(currentLocale, options);
    return dateFormatter.format(duration);
  }
);
