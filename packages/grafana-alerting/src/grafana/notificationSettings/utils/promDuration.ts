// Mirrors the backend's Prometheus ParseDuration: each unit at most once, from largest to smallest.
// Overflow (about 290 years) is left to the backend.
const PROM_DURATION = /^(\d+y)?(\d+w)?(\d+d)?(\d+h)?(\d+m)?(\d+s)?(\d+ms)?$/;

/** Empty/undefined is valid because the field is optional. */
export function isValidPromDuration(duration?: string): boolean {
  return !duration || duration === '0' || PROM_DURATION.test(duration);
}
