function limitFloatingPrecision(x: number, precision: number): string {
  return parseFloat(x.toFixed(precision)).toString();
}

/**
 * Formats a duration provided in seconds. If smaller than 0, the most suitable
 * unit will be picked. Truncated at precision, not rounded.
 * (Ex.: (0.043678, 2) => '43.67 ms')
 */
export function formatDuration(duration: number, precision = 1): string {
  return duration > 1
    ? limitFloatingPrecision(duration, precision) + ' s'
    : duration * 1000 > 1
    ? limitFloatingPrecision(duration * 1000, precision) + ' ms'
    : limitFloatingPrecision(duration * 1000 * 1000, precision) + ' μs';
}
