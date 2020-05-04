import { TimeZone, DefaultTimeZone } from '../types/time';

/**
 * Type describing the date and time helper function options. Used for all the
 * helper functions available to parse and format date and time values.
 *
 * @public
 */
export interface DateTimeOptions {
  /**
   * Specify if you want to override the timeZone used when parsing or formatting
   * a date and time value. If no timeZone is set the default timeZone for the current
   * user will be used.
   */
  timeZone?: TimeZone;
}

/**
 * Type to describe the time zone resolver function that will be used to access
 * the default time zone of an user.
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
 * is not set in the options a default timeZone will be resolved instead.
 *
 * @internal
 */
export const getTimeZone = <T extends DateTimeOptions>(options?: T): TimeZone => {
  return options?.timeZone ?? defaultTimeZoneResolver() ?? DefaultTimeZone;
};
