import { createBreakpoints, ThemeBreakpoints } from './breakpoints';
import { createColors, ThemeColors, ThemeColorsInput } from './createColors';
import { createSpacing, ThemeSpacingOptions, ThemeSpacing } from './createSpacing';

export interface GrafanaTheme {
  name: string;
  isDark: boolean;
  isLight: boolean;
  colors: ThemeColors;
  breakpoints: ThemeBreakpoints;
  spacing: ThemeSpacing;
}

export interface NewThemeOptions {
  name?: string;
  colors?: ThemeColorsInput;
  spacing?: ThemeSpacingOptions;
}

export function createTheme(options: NewThemeOptions = {}): GrafanaTheme {
  const { name = 'Dark', colors: colorsInput = {}, spacing: spacingInput = {} } = options;

  const colors = createColors(colorsInput);
  const breakpoints = createBreakpoints();
  const spacing = createSpacing(spacingInput);

  return {
    name,
    isDark: colors.mode === 'dark',
    isLight: colors.mode === 'light',
    colors,
    breakpoints,
    spacing,
  };
}
