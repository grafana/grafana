import { TimeZone, DefaultTimeZone } from '../types/time';

/**
 * Used for helper functions handling time zones.
 *
 * @public
 */
export interface TimeZoneOptions {
  /**
   * Specify this if you want to override the timeZone used when parsing or formatting
   * a date and time value. If no timeZone is set, the default timeZone for the current
   * user is used.
   */
  timeZone?: TimeZone;
}

/**
 * The type describing date and time options. Used for all the helper functions
 * available to parse or format date and time values.
 *
 * @public
 */
export interface DateTimeOptions extends TimeZoneOptions {
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
 * Used to get the current selected time zone. If a valid time zone is passed in the
 * options it will be returned. If no valid time zone is passed either the time zone
 * configured for the user account will be returned or the default for Grafana.
 *
 * @public
 */
export const getTimeZone = <T extends TimeZoneOptions>(options?: T): TimeZone => {
  return options?.timeZone ?? defaultTimeZoneResolver() ?? DefaultTimeZone;
};
