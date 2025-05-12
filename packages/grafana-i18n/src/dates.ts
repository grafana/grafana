// import '@formatjs/intl-durationformat/polyfill';
import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

let regionalFormat: string | undefined;

const createDateTimeFormatter = deepMemoize((locale: string | undefined, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat(locale, options);
});
// @ts-expect-error
const createDurationFormatter = deepMemoize((locale: string | undefined, options: Intl.DurationFormatOptions) => {
  // @ts-expect-error
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    if (typeof value === 'string') {
      return formatDate(new Date(value), format);
    }
    const dateFormatter = createDateTimeFormatter(regionalFormat, format);
    return dateFormatter.format(value);
  }
);

export const formatDuration = deepMemoize(
  // @ts-expect-error
  (duration: Intl.DurationInput, options: Intl.DurationFormatOptions = {}): string => {
    const dateFormatter = createDurationFormatter(regionalFormat, options);
    return dateFormatter.format(duration);
  }
);

export const initRegionalFormat = (regionalFormatArg: string) => {
  regionalFormat = regionalFormatArg;
  console.log('initRegionalFormat', regionalFormat);
};
