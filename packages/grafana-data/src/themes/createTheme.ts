import { createBreakpoints, ThemeBreakpoints } from './breakpoints';
import { createColors, ThemeColors, ThemeColorsInput } from './colors';

export interface GrafanaTheme {
  name: string;
  isDark: boolean;
  isLight: boolean;
  colors: ThemeColors;
  breakpoints: ThemeBreakpoints;
}

export interface NewThemeOptions {
  name?: string;
  colors?: ThemeColorsInput;
}

export function createTheme(options: NewThemeOptions = {}): GrafanaTheme {
  const { name = 'Dark', colors: colorsInput = {} } = options;

  const colors = createColors(colorsInput);
  const breakpoints = createBreakpoints();

  return {
    name,
    isDark: colors.mode === 'dark',
    isLight: colors.mode === 'light',
    colors,
    breakpoints,
  };
}
