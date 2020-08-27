export interface SystemDateFormatSettings {
  fullDate: string;
  intervals: {
    PT1S: string;
    PT1M: string;
    PT1H: string;
    PT1D: string;
    P1YT: string;
  };
  useBrowserLocale: boolean;
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export class SystemDateFormatsState {
  fullDate = DEFAULT_DATE_FORMAT;
  intervals = {
    PT1S: 'HH:mm:ss',
    PT1M: 'HH:mm',
    PT1H: 'MM-DD HH:mm',
    PT1D: 'YYYY-MM-DD',
    P1YT: 'YYYY',
  };

  update(settings: SystemDateFormatSettings) {
    this.fullDate = settings.fullDate;
    this.intervals = settings.intervals;

    if (settings.useBrowserLocale) {
      this.useBrowserLocale();
    }
  }

  get fullDateMS() {
    return `${this.fullDate}.SSS`;
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

    this.intervals.PT1S = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
      null,
      this.intervals.PT1S
    );
    this.intervals.PT1M = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.intervals.PT1M
    );
    this.intervals.PT1H = localTimeFormat(
      { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.intervals.PT1H
    );
    this.intervals.PT1D = localTimeFormat(
      { month: '2-digit', day: '2-digit', hour12: false },
      null,
      this.intervals.PT1D
    );
    this.intervals.P1YT = localTimeFormat(
      { year: 'numeric', month: '2-digit', hour12: false },
      null,
      this.intervals.P1YT
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
    return fallback ?? DEFAULT_DATE_FORMAT;
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

export const defaultDateFormats = new SystemDateFormatsState();
