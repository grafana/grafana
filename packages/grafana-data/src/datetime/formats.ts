/**
 * localTimeFormat helps to generate date formats for momentjs based on browser's locale
 *
 * @param locale browser locale, or default
 * @param options DateTimeFormatOptions to format date
 * @param fallback default format if Intl API is not present
 */
export const localTimeFormat = (
  locale: string | string[],
  options: Intl.DateTimeFormatOptions,
  fallback: string
): string => {
  if (!window.Intl) {
    return fallback;
  }

  // https://momentjs.com/docs/#/displaying/format/
  const parts = new Intl.DateTimeFormat(locale, options).formatToParts(new Date());
  const mapping: { [key: string]: string } = {
    year: 'YYYY',
    month: 'MM',
    day: 'DD',
    hour: 'HH',
    minute: 'mm',
    second: 'ss',
    weekday: 'ddd',
    era: 'N',
    dayPeriod: 'A',
    timeZoneName: 'Z',
  };

  return parts.map(part => mapping[part.type] || part.value).join('');
};

export const DEFAULT_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const MS_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

/* export const DEFAULT_DATE_TIME_FORMAT = localTimeFormat(
  [...navigator.languages],
  {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
  'YYYY-MM-DD HH:mm:ss'
);
export const MS_DATE_TIME_FORMAT = localTimeFormat(
  [...navigator.languages],
  {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  },
  'YYYY-MM-DD HH:mm:ss'
).replace('ss', 'ss.SSS'); */
