import { CSSInterpolation } from '@emotion/css';

import { GrafanaTheme2, ThemeBreakpointsKey } from '@grafana/data';

/**
 * Type that represents a prop that can be responsive.
 *
 * @example To turn a prop like `margin: number` responsive, change it to `margin: ResponsiveProp<number>`.
 */
export type ResponsiveProp<T> =
  | T
  | {
      base: T;
      xs?: T;
      sm?: T;
      md?: T;
      lg?: T;
      xl?: T;
      xxl?: T;
    };

/**
 * Function that converts a ResponsiveProp object into CSS
 *
 * @param theme Grafana theme object
 * @param prop Prop as it is passed to the component
 * @param getCSS Function that returns the css block for the prop
 * @returns The CSS block repeated for each breakpoint
 *
 * @example To get the responsive css equivalent of `margin && { margin }`, you can write `getResponsiveStyle(theme, margin, (val) => { margin: val })`
 */
export function getResponsiveStyle<T>(
  theme: GrafanaTheme2,
  prop: ResponsiveProp<T> | undefined,
  getCSS: (val: T) => CSSInterpolation
): CSSInterpolation {
  if (prop === undefined || prop === null) {
    return null;
  }
  if (typeof prop === 'object' && 'base' in prop) {
    const breakpointCSS = (key: ThemeBreakpointsKey) => {
      const value = prop[key];
      if (value !== undefined && value !== null) {
        return {
          [theme.breakpoints.up(key)]: getCSS(value),
        };
      }
      return;
    };

    return [
      getCSS(prop.base),
      breakpointCSS('xs'),
      breakpointCSS('sm'),
      breakpointCSS('md'),
      breakpointCSS('lg'),
      breakpointCSS('xl'),
      breakpointCSS('xxl'),
    ];
  }

  return getCSS(prop);
}
