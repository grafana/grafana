import { TimeZone, DefaultTimeZone } from '../types/time';

/**
 * The type describing date and time options. Used for all the helper functions
 * available to parse or format date and time values.
 *
 * @public
 */
export interface DateTimeOptions {
  /**
   * Specify this if you want to override the timeZone used when parsing or formatting
   * a date and time value. If no timeZone is set, the default timeZone for the current
   * user is used.
   */
  timeZone?: TimeZone;

  /**
   * Specify a {@link https://momentjs.com/docs/#/displaying/format | momentjs} format to
   * use a custom formatting pattern or parsing pattern. If no format is set,
   * then system configured default format is used.
   */
  format?: string;
}

/**
 * The type to describe the time zone resolver function that will be used to access
 * the default time zone of a user.
 *
 * @public
 */
export type TimeZoneResolver = () => TimeZone | undefined;

let defaultTimeZoneResolver: TimeZoneResolver = () => DefaultTimeZone;

/**
 * Used by Grafana internals to set the {@link TimeZoneResolver} to access the current
 * user timeZone.
 *
 * @internal
 */
export const setTimeZoneResolver = (resolver: TimeZoneResolver) => {
  defaultTimeZoneResolver = resolver ?? defaultTimeZoneResolver;
};

/**
 * Used within this package to get timeZone from an options value. If timezone
 * is not set in the options, then a default timeZone is be resolved instead.
 *
 * @internal
 */
export const getTimeZone = <T extends DateTimeOptions>(options?: T): TimeZone => {
  return options?.timeZone ?? defaultTimeZoneResolver() ?? DefaultTimeZone;
};
