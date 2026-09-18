import { formattedValueToString, getValueFormat } from '@grafana/data';

import { type SolutionStats } from './types';

const shortNumber = getValueFormat('short');

/** Compact "short" rendering (1.2K, 4.80 Mil) shared by every solution card. */
export function formatCount(count: number): string {
  return formattedValueToString(shortNumber(count));
}

/**
 * The "N things · X% something" card shape. A missing or non-positive count reads as no stats;
 * the ratio is optional and rendered as a percent rounded to one decimal.
 */
export function countRatioStats(
  count: number | null | undefined,
  ratio: number | null | undefined,
  primary: (count: number, formatted: string) => string,
  secondary: (percent: number) => string
): SolutionStats | null {
  if (count == null || count <= 0) {
    return null;
  }
  const whole = Math.ceil(count);
  return {
    primary: primary(whole, formatCount(whole)),
    secondary: ratio != null ? secondary(parseFloat((ratio * 100).toFixed(1))) : undefined,
  };
}
