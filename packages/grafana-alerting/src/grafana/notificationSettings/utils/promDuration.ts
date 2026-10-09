import { type RoutingTimings } from '../constants';

// Mirrors the backend's Prometheus ParseDuration: each unit at most once, from largest to smallest.
// Overflow (about 290 years) is left to the backend.
const PROM_DURATION = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/;

/** Empty/undefined is valid because the field is optional. Pass `allowZero: false` for fields the backend
 * requires to be greater than zero. */
export function isValidPromDuration(duration?: string, { allowZero = true } = {}): boolean {
  if (!duration) {
    return true;
  }
  if (!allowZero && !/[1-9]/.test(duration)) {
    return false;
  }
  return duration === '0' || PROM_DURATION.test(duration);
}

/** Save guard for `RoutingTimings`: the backend allows a zero group wait but not a zero group or repeat interval. */
export function isValidRoutingTimings({ groupWait, groupInterval, repeatInterval }: RoutingTimings): boolean {
  return (
    isValidPromDuration(groupWait) &&
    isValidPromDuration(groupInterval, { allowZero: false }) &&
    isValidPromDuration(repeatInterval, { allowZero: false })
  );
}
