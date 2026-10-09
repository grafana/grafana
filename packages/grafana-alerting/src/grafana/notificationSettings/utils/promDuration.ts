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

/** Save guard for `RoutingTimings`: the backend allows a zero group wait but not a zero group or repeat interval,
 * and the rules API timing schema has no milliseconds unit. */
export function isValidRoutingTimings({ groupWait, groupInterval, repeatInterval }: RoutingTimings): boolean {
  return (
    isValidPromDuration(groupWait, { allowMilliseconds: false }) &&
    isValidPromDuration(groupInterval, { allowZero: false, allowMilliseconds: false }) &&
    isValidPromDuration(repeatInterval, { allowZero: false, allowMilliseconds: false })
  );
}
