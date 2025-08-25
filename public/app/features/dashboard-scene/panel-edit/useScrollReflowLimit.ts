import memoizeOne from 'memoize-one';
import { useMedia } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

/**
 * returns the media query body "(max-height: 543.95px), (max-width: 768.95px)" to apply styles
 * or conditions when the screen is small enough to hit zoom reflow problems.
 * The math in here should be replaced with changes in breakpoints.ts to export what's required
 * to calculate it.
 */
export const getScrollReflowMediaQuery = memoizeOne(function getScrollReflowMediaQueryNoMemo(
  theme: GrafanaTheme2
): string {
  // the .05 comes from packages/grafana-data/src/themes/breakpoints.ts
  const sm = theme.breakpoints.values.sm - 0.05;
  const md = theme.breakpoints.values.md - 0.05;
  const unit = theme.breakpoints.unit;
  return `(max-height: ${sm}${unit}), (max-width: ${md}${unit})`;
});

/**
 * @returns {boolean} true when the screen is small enough to need zoom reflow handling
 */
export function useScrollReflowLimit(): boolean {
  const theme = useTheme2();
  return useMedia(getScrollReflowMediaQuery(theme));
}
