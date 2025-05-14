// import '@formatjs/intl-durationformat/polyfill';
import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

// TODO: get types for Intl.DurationFormatOptions and Intl.DurationInput
// from either polyfill, @types package, or by tweaking ts settings

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

let regionalFormat: string | undefined;

const createDateTimeFormatter = deepMemoize((locale: string | undefined, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat(locale, options);
});

const createDurationFormatter = deepMemoize((locale: string | undefined, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }
    console.log('formatting date with locale', regionalFormat);
    const dateFormatter = createDateTimeFormatter(regionalFormat, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const dateFormatter = createDurationFormatter(regionalFormat, options);
    return dateFormatter.format(duration);
  }
);

export const formatDateRange = (from: Date, to: Date, format: Intl.DateTimeFormatOptions = {}): string => {
  const dateFormatter = createDateTimeFormatter(regionalFormat, format);
  return dateFormatter.formatRange(from, to);
};

export const initRegionalFormat = (regionalFormatArg: string) => {
  regionalFormat = regionalFormatArg;
  console.log('initRegionalFormat', regionalFormat);
};
