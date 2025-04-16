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


export const formatRange = ( range: string, options: Intl.DurationFormatOptions = {}): string => {
  // Split the date using regex to get the "to" word, even translated, to get the "from" and "to" values
  const regex = /([a-zA-Z]+)/g;
  const timeRangeSplit = range.split(regex);
  const from = timeRangeSplit[0];
  const to = timeRangeSplit[2];
  // If from and to are not empty, localise them using the formatDate function
  if (from && to) {
    const fromLocalised = formatDate(from, options);
    const toLocalised = formatDate(to, options);
    const separator = timeRangeSplit[1];
    return `${fromLocalised} ${separator} ${toLocalised}`;
  }
  return range;
}
