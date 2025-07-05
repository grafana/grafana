import deepEqual from 'fast-deep-equal';
import memoize from 'micro-memoize';

const deepMemoize: typeof memoize = (fn) => memoize(fn, { isEqual: deepEqual });

let regionalFormat: string | undefined;

const createDateTimeFormatter = deepMemoize((locale: string | undefined, options: Intl.DateTimeFormatOptions) => {
  return new Intl.DateTimeFormat(locale, options);
});

const createDurationFormatter = deepMemoize((locale: string | undefined, options: Intl.DurationFormatOptions) => {
  return new Intl.DurationFormat(locale, options);
});

export const formatDate = deepMemoize(
  (_value: number | Date | string, format: Intl.DateTimeFormatOptions = {}): string => {
    const value = typeof _value === 'string' ? new Date(_value) : _value;
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

const memoizedLocalTimeFormat = deepMemoize(localTimeFormat);

export const parseFormat = (formatOptions: Intl.DateTimeFormatOptions = {}): string | undefined => {
  if (regionalFormat == null) {
    return undefined;
  }
  return memoizedLocalTimeFormat(formatOptions, regionalFormat);
};

export const formatDateRange = (
  _from: number | Date | string,
  _to: number | Date | string,
  format: Intl.DateTimeFormatOptions = {}
): string => {
  const from = typeof _from === 'string' ? new Date(_from) : _from;
  const to = typeof _to === 'string' ? new Date(_to) : _to;

  const dateFormatter = createDateTimeFormatter(regionalFormat, format);
  return dateFormatter.formatRange(from, to);
};

/**
 *
 * @param regionalFormatArg locale string such as en-US or fr-FR
 */
export const initRegionalFormat = (regionalFormatArg: string) => {
  regionalFormat = regionalFormatArg;
};

// @ts-expect-error this is copied (and slightly modified) from @grafana/data, because this is the functionality needed
// for getting the date format itself to use with moment for parsing.
// TODO re-organize in a way that makes sense.
/**
 * localTimeFormat helps to generate date formats for momentjs based on browser's locale
 *
 * @param locale browser locale, or default
 * @param options DateTimeFormatOptions to format date
 * @param fallback default format if Intl API is not present
 */
export function localTimeFormat(options: Intl.DateTimeFormatOptions, locale: string | string[]): string {
  if (!locale && navigator) {
    locale = [...navigator.languages];
  }

  // https://momentjs.com/docs/#/displaying/format/
  const dateTimeFormat = new Intl.DateTimeFormat(locale || undefined, options);
  const parts = dateTimeFormat.formatToParts(new Date());
  const hour12 = dateTimeFormat.resolvedOptions().hour12;

  const mapping: { [key: string]: string } = {
    year: 'YYYY',
    month: 'MM',
    day: 'DD',
    hour: hour12 ? 'hh' : 'HH',
    minute: 'mm',
    second: 'ss',
    weekday: 'ddd',
    era: 'N',
    dayPeriod: 'A',
    timeZoneName: 'Z',
  };

  return parts.map((part) => mapping[part.type] || part.value).join('');
}
