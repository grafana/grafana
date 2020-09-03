export interface SystemDateFormatSettings {
  fullDate: string;
  intervals: {
    seconds: string;
    minutes: string;
    hours: string;
    days: string;
    months: string;
    years: string;
  };
  useBrowserLocale: boolean;
}

const DEFAULT_SYSTEM_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export class SystemDateFormatsState {
  fullDate = DEFAULT_SYSTEM_DATE_FORMAT;
  intervals = {
    seconds: 'HH:mm:ss',
    minutes: 'HH:mm',
    hours: 'MM-DD HH:mm',
    days: 'MM-DD',
    months: 'YYYY-MM',
    years: 'YYYY',
  };

  update(settings: SystemDateFormatSettings) {
    this.fullDate = settings.fullDate;
    this.intervals = settings.intervals;

    if (settings.useBrowserLocale) {
      this.useBrowserLocale();
    }
  }

  get fullDateMS() {
    // Add millisecond to seconds part
    return this.fullDate.replace('ss', 'ss.SSS');
  }

  useBrowserLocale() {
    this.fullDate = localTimeFormat({
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    this.intervals.seconds = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
      null,
      this.intervals.seconds
    );
    this.intervals.minutes = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.intervals.minutes
    );
    this.intervals.hours = localTimeFormat(
      { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.intervals.hours
    );
    this.intervals.days = localTimeFormat(
      { month: '2-digit', day: '2-digit', hour12: false },
      null,
      this.intervals.days
    );
    this.intervals.months = localTimeFormat(
      { year: 'numeric', month: '2-digit', hour12: false },
      null,
      this.intervals.months
    );
  }

  getTimeFieldUnit(useMsResolution?: boolean) {
    return `time:${useMsResolution ? this.fullDateMS : this.fullDate}`;
  }
}

/**
 * localTimeFormat helps to generate date formats for momentjs based on browser's locale
 *
 * @param locale browser locale, or default
 * @param options DateTimeFormatOptions to format date
 * @param fallback default format if Intl API is not present
 */
export function localTimeFormat(
  options: Intl.DateTimeFormatOptions,
  locale?: string | string[] | null,
  fallback?: string
): string {
  if (!window.Intl) {
    return fallback ?? DEFAULT_SYSTEM_DATE_FORMAT;
  }

  if (!locale) {
    locale = [...navigator.languages];
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
}

export const systemDateFormats = new SystemDateFormatsState();
