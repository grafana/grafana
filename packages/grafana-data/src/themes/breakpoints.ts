/** @beta */
export interface ThemeBreakpointValues {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

/** @beta */
export type ThemeBreakpointsKey = keyof ThemeBreakpointValues;

/** @beta */
export interface ThemeBreakpoints {
  values: ThemeBreakpointValues;
  keys: string[];
  unit: string;
  up: (key: ThemeBreakpointsKey | number) => string;
  down: (key: ThemeBreakpointsKey | number) => string;
}

/** @internal */
export function createBreakpoints(): ThemeBreakpoints {
  const step = 5;
  const keys = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
  const unit = 'px';
  const values: ThemeBreakpointValues = {
    xs: 0,
    sm: 544,
    md: 769, // 1 more than regular ipad in portrait
    lg: 992,
    xl: 1200,
    xxl: 1440,
  };

  function up(key: ThemeBreakpointsKey | number) {
    const value = typeof key === 'number' ? key : values[key];
    return `@media (min-width:${value}${unit})`;
  }

  function down(key: ThemeBreakpointsKey | number) {
    const value = typeof key === 'number' ? key : values[key];
    return `@media (max-width:${value - step / 100}${unit})`;
  }

  // TODO add functions for between and only

  return {
    values,
    up,
    down,
    keys,
    unit,
  };
}
