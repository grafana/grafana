import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

import { getLanguage } from '@grafana/i18n/internal';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

const createDateTimeFormatter = deepMemoize((locale: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat('en-US', options);
  }
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }

    const currentLocale = getLanguage();

    const dateFormatter = createDateTimeFormatter(currentLocale, format);
    return dateFormatter.format(value);
  }
);
