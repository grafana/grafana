import { createBreakpoints, ThemeBreakpoints } from './breakpoints';
import { createPalette, ThemePalette, ThemePaletteInput } from './createPalette';
import { createShape, ThemeShape, ThemeShapeInput } from './createShape';
import { createSpacing, ThemeSpacingOptions, ThemeSpacing } from './createSpacing';

export interface GrafanaThemeV2 {
  name: string;
  isDark: boolean;
  isLight: boolean;
  palette: ThemePalette;
  breakpoints: ThemeBreakpoints;
  spacing: ThemeSpacing;
  shape: ThemeShape;
}

export interface NewThemeOptions {
  name?: string;
  palette?: ThemePaletteInput;
  spacing?: ThemeSpacingOptions;
  shape?: ThemeShapeInput;
}

export function createTheme(options: NewThemeOptions = {}): GrafanaThemeV2 {
  const { name = 'Dark', palette: paletteInput = {}, spacing: spacingInput = {}, shape: shapeInput = {} } = options;

  const palette = createPalette(paletteInput);
  const breakpoints = createBreakpoints();
  const spacing = createSpacing(spacingInput);
  const shape = createShape(shapeInput);

  return {
    name,
    isDark: palette.mode === 'dark',
    isLight: palette.mode === 'light',
    palette,
    breakpoints,
    spacing,
    shape,
  };
}
