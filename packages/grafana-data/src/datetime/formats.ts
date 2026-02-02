export interface SystemDateFormatSettings {
  fullDate: string;
  interval: {
    millisecond: string;
    second: string;
    minute: string;
    hour: string;
    day: string;
    month: string;
    year: string;
  };
  useBrowserLocale: boolean;
}

const DEFAULT_SYSTEM_DATE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
const DEFAULT_SYSTEM_DATE_MS_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS';

export class SystemDateFormatsState {
  fullDate = DEFAULT_SYSTEM_DATE_FORMAT;
  fullDateMS = DEFAULT_SYSTEM_DATE_MS_FORMAT;
  interval = {
    millisecond: 'HH:mm:ss.SSS',
    second: 'HH:mm:ss',
    minute: 'HH:mm',
    hour: 'MM/DD HH:mm',
    day: 'MM/DD',
    month: 'YYYY-MM',
    year: 'YYYY',
  };

  update(settings: SystemDateFormatSettings) {
    this.fullDate = settings.fullDate;
    this.interval = settings.interval;

    if (settings.useBrowserLocale) {
      this.useBrowserLocale();
    }
    // BMC Change: Below else block
    // We have `useBrowserLocale` enabled for all stacks by default
    // And if this flag is not enabled,
    // that means custom date format is set thru preferences.
    // In that case fullDateMS should be same as fullDate
    else {
      this.fullDateMS = settings.fullDate;
    }
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

    // ES5 doesn't support `DateTimeFormatOptions.fractionalSecondDigits` so we have to use
    // a hack with string replacement.
    this.fullDateMS = this.fullDate.replace('ss', 'ss.SSS');

    this.interval.millisecond = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
      null,
      this.interval.second
    ).replace('ss', 'ss.SSS');
    this.interval.second = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
      null,
      this.interval.second
    );
    this.interval.minute = localTimeFormat(
      { hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.interval.minute
    );
    this.interval.hour = localTimeFormat(
      { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false },
      null,
      this.interval.hour
    );
    this.interval.day = localTimeFormat({ month: '2-digit', day: '2-digit', hour12: false }, null, this.interval.day);
    this.interval.month = localTimeFormat(
      { year: 'numeric', month: '2-digit', hour12: false },
      null,
      this.interval.month
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
  if (missingIntlDateTimeFormatSupport()) {
    return fallback ?? DEFAULT_SYSTEM_DATE_FORMAT;
  }

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

  // BMC Change: Next line inline
  return parts
    .map((part) => {
      if (part.type === 'literal') {
        const safeLiteral = part.value === '\u202F' ? ' ' : part.value; // Replace U+202F with space
        // Escape any literal that contains moment formatting letters
        const needsEscaping = /[a-zA-Z]/.test(safeLiteral);
        return needsEscaping ? `[${safeLiteral}]` : safeLiteral;
      }
      return mapping[part.type] || part.value;
    })
    .join('');
}

export const systemDateFormats = new SystemDateFormatsState();

const missingIntlDateTimeFormatSupport = (): boolean => {
  return !('DateTimeFormat' in Intl) || !('formatToParts' in Intl.DateTimeFormat.prototype);
};
