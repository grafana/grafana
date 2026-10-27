import { type RoutingTimings } from '../constants';

// Mirrors the backend's Prometheus ParseDuration: each unit at most once, from largest to smallest.
// Overflow (about 290 years) is left to the backend.
const PROM_DURATION = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/;
const PROM_DURATION_NO_MILLIS = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?$/;

/** Empty/undefined is valid because the field is optional. Pass `allowZero: false` for fields the backend
 * requires to be greater than zero, and `allowMilliseconds: false` for fields whose API schema has no `ms` unit. */
export function isValidPromDuration(duration?: string, { allowZero = true, allowMilliseconds = true } = {}): boolean {
  if (!duration) {
    return true;
  }
  if (!allowZero && !/[1-9]/.test(duration)) {
    return false;
  }
  return duration === '0' || (allowMilliseconds ? PROM_DURATION : PROM_DURATION_NO_MILLIS).test(duration);
}

/** Why the backend would reject a timing: `format` for a malformed duration or one with milliseconds, which the rules
 * API timing schema has no unit for, and `zero` for a zero where it must be positive. */
export type RoutingTimingError = 'format' | 'zero';

function getTimingError(duration: string | undefined, allowZero: boolean): RoutingTimingError | undefined {
  if (!isValidPromDuration(duration, { allowMilliseconds: false })) {
    return 'format';
  }
  return isValidPromDuration(duration, { allowZero, allowMilliseconds: false }) ? undefined : 'zero';
}

/** The timings the backend would reject, each with its reason. It allows a zero group wait but not a zero group or
 * repeat interval. Unset timings are valid because they are inherited. */
export function getRoutingTimingErrors({
  groupWait,
  groupInterval,
  repeatInterval,
}: RoutingTimings): Partial<Record<keyof RoutingTimings, RoutingTimingError>> {
  const errors: Partial<Record<keyof RoutingTimings, RoutingTimingError>> = {};
  const groupWaitError = getTimingError(groupWait, true);
  const groupIntervalError = getTimingError(groupInterval, false);
  const repeatIntervalError = getTimingError(repeatInterval, false);
  if (groupWaitError) {
    errors.groupWait = groupWaitError;
  }
  if (groupIntervalError) {
    errors.groupInterval = groupIntervalError;
  }
  if (repeatIntervalError) {
    errors.repeatInterval = repeatIntervalError;
  }
  return errors;
}
