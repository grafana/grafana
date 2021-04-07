import { createBreakpoints, ThemeBreakpoints } from './breakpoints';
import { ThemeComponents, createComponents } from './createComponents';
import { createPalette, ThemePalette, ThemePaletteInput } from './createPalette';
import { createShadows, ThemeShadows } from './createShadows';
import { createShape, ThemeShape, ThemeShapeInput } from './createShape';
import { createSpacing, ThemeSpacingOptions, ThemeSpacing } from './createSpacing';
import { createTypography, ThemeTypography, ThemeTypographyInput } from './createTypography';
import { ThemeZIndices, zIndex } from './zIndex';

/** @beta */
export interface GrafanaThemeV2 {
  name: string;
  isDark: boolean;
  isLight: boolean;
  palette: ThemePalette;
  breakpoints: ThemeBreakpoints;
  spacing: ThemeSpacing;
  shape: ThemeShape;
  components: ThemeComponents;
  typography: ThemeTypography;
  zIndex: ThemeZIndices;
  shadows: ThemeShadows;
}

/** @internal */
export interface NewThemeOptions {
  name?: string;
  palette?: ThemePaletteInput;
  spacing?: ThemeSpacingOptions;
  shape?: ThemeShapeInput;
  typography?: ThemeTypographyInput;
}

/** @internal */
export function createTheme(options: NewThemeOptions = {}): GrafanaThemeV2 {
  const {
    name = 'Dark',
    palette: paletteInput = {},
    spacing: spacingInput = {},
    shape: shapeInput = {},
    typography: typographyInput = {},
  } = options;

  const palette = createPalette(paletteInput);
  const breakpoints = createBreakpoints();
  const spacing = createSpacing(spacingInput);
  const shape = createShape(shapeInput);
  const components = createComponents();
  const typography = createTypography(palette, typographyInput);
  const shadows = createShadows(palette);

  return {
    name,
    isDark: palette.mode === 'dark',
    isLight: palette.mode === 'light',
    palette,
    breakpoints,
    spacing,
    shape,
    components,
    typography,
    shadows,
    zIndex: {
      ...zIndex,
    },
  };
}
