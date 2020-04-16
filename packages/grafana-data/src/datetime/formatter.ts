import { TimeZone } from '../types';
/* eslint-disable id-blacklist, no-restricted-imports, @typescript-eslint/ban-types */
import moment, { MomentInput, Moment } from 'moment-timezone';
import { DateTimeInput } from './moment_wrapper';
import { DEFAULT_DATE_TIME_FORMAT, MS_DATE_TIME_FORMAT } from './formats';

type TimeZoneResolver = () => TimeZone;

export interface DateTimeFormatter {
  format(dateInUtc: DateTimeInput, format?: string): string;
  defaultWithMs(dateInUtc: DateTimeInput): string;
  timeAgo(dateInUtc: DateTimeInput): string;
}

export const getDateTimeFormatter = (getTimeZone: TimeZoneResolver): DateTimeFormatter =>
  new DateTimeWithTimeZone(getTimeZone);

class DateTimeWithTimeZone implements DateTimeFormatter {
  constructor(private getTimeZone: TimeZoneResolver) {}

  format(dateInUtc: DateTimeInput, format: string = DEFAULT_DATE_TIME_FORMAT): string {
    return this.toTz(dateInUtc as MomentInput).format(format);
  }

  defaultWithMs(dateInUtc: DateTimeInput): string {
    return this.toTz(dateInUtc as MomentInput).format(MS_DATE_TIME_FORMAT);
  }

  timeAgo(dateInUtc: DateTimeInput): string {
    return this.toTz(dateInUtc as MomentInput).fromNow();
  }

  private toTz(dateInUtc: MomentInput): Moment {
    const timeZone = this.getTimeZone();

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
