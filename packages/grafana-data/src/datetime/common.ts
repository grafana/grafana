import { TimeZone, DefaultTimeZone } from '../types/time';

export interface DateTimeOptions {
  timeZone?: TimeZone;
}

export type TimeZoneResolver = () => TimeZone | undefined;

let defaultTimeZoneResolver: TimeZoneResolver = () => DefaultTimeZone;

export const setTimeZoneResolver = (resolver: TimeZoneResolver) => {
  defaultTimeZoneResolver = resolver ?? defaultTimeZoneResolver;
};

export const getTimeZone = <T extends DateTimeOptions>(options?: T): TimeZone => {
  return options?.timeZone ?? defaultTimeZoneResolver() ?? DefaultTimeZone;
};
