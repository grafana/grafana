export interface SystemDateFormatSettings {
  fullDate: string;
  intervals: {
    PT1S: string;
    PT1M: string;
    PT1H: string;
    PT1D: string;
    P1YT: string;
  };
}

export class SystemDateFormatsState {
  fullDate = 'YYYY-MM-DD HH:mm:ss';
  fullDateMS = 'YYYY-MM-DD HH:mm:ss.SSS';
  intervals = {
    PT1S: 'HH:mm:ss',
    PT1M: 'HH:mm',
    PT1H: 'MM-DD HH:mm',
    PT1D: 'YYYY-MM-DD',
    P1YT: 'YYYY-MM',
  };

  update(settings: SystemDateFormatSettings) {
    this.fullDate = settings.fullDate;
    this.fullDateMS = `${settings.fullDate}.SSS`;
    this.intervals = settings.intervals;
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

export const defaultDateFormats = new SystemDateFormatsState();
