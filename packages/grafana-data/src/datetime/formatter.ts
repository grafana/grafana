/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import { TimeZone, DefaultTimeZone } from '../types';
import moment, { MomentInput, Moment } from 'moment-timezone';
import { DateTimeInput } from './moment_wrapper';
import { DEFAULT_DATE_TIME_FORMAT, MS_DATE_TIME_FORMAT } from './formats';

export type TimeZoneResolver = () => TimeZone | undefined;

export interface DateTimeFormatter {
  format(dateInUtc: DateTimeInput, format?: string): string;
  formatISO(dateInUtc: DateTimeInput): string;
  formatDefault(dateInUtc: DateTimeInput, includeMS: boolean): string;
  formatDistanceToNow(dateInUtc: DateTimeInput): string;
}

let defaultTimeZoneResolver: TimeZoneResolver = () => DefaultTimeZone;

export const setTimeZoneResolver = (resolver: TimeZoneResolver) => {
  defaultTimeZoneResolver = resolver ?? defaultTimeZoneResolver;
};

export const createDateTimeFormatter = (getTimeZone: TimeZoneResolver = defaultTimeZoneResolver): DateTimeFormatter =>
  new DateTimeFormatterWithTimeZone(getTimeZone);

class DateTimeFormatterWithTimeZone implements DateTimeFormatter {
  constructor(private getTimeZone: TimeZoneResolver) {}

  format(dateInUtc: DateTimeInput, format: string = DEFAULT_DATE_TIME_FORMAT): string {
    return this.toTz(dateInUtc as MomentInput).format(format);
  }

  formatDefault(dateInUtc: DateTimeInput, includeMS: boolean): string {
    const format = includeMS ? MS_DATE_TIME_FORMAT : DEFAULT_DATE_TIME_FORMAT;
    return this.toTz(dateInUtc as MomentInput).format(format);
  }

  formatISO(dateInUtc: DateTimeInput): string {
    return this.toTz(dateInUtc as MomentInput).format();
  }

  formatDistanceToNow(dateInUtc: DateTimeInput): string {
    return this.toTz(dateInUtc as MomentInput).fromNow();
  }

  private toTz(dateInUtc: MomentInput): Moment {
    const timeZone = this.getTimeZone() ?? defaultTimeZoneResolver() ?? DefaultTimeZone;

    switch (timeZone) {
      case 'utc':
        return moment.utc(dateInUtc);
      case '':
      case 'browser':
        return moment.utc(dateInUtc).local();
      default:
        return moment.utc(dateInUtc).tz(timeZone);
    }
  }
}
