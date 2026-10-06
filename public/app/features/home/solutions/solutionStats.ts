import { formattedValueToString, getValueFormat } from '@grafana/data';

import { type SolutionStats } from './types';

const shortNumber = getValueFormat('short');
const percentUnit = getValueFormat('percentunit');

/** Compact "short" rendering (1.2K, 4.80 Mil) shared by every solution card. */
export function formatCount(count: number): string {
  return formattedValueToString(shortNumber(count));
}

/**
 * The "N things · X% something" card shape. A missing or non-positive count reads as no stats;
 * the ratio is optional and rendered as a percent with Grafana's automatic decimals, so a
 * sub-0.1% error rate stays visible instead of rounding to 0%.
 */
export function countRatioStats(
  count: number | null | undefined,
  ratio: number | null | undefined,
  primary: (count: number, formatted: string) => string,
  secondary: (percent: string) => string
): SolutionStats | null {
  if (count == null || count <= 0) {
    return null;
  }
  const whole = Math.ceil(count);
  return {
    primary: primary(whole, formatCount(whole)),
    secondary: ratio != null ? secondary(formattedValueToString(percentUnit(ratio))) : undefined,
  };
}
