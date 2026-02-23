import * as z from 'zod';

import { createBreakpoints } from './breakpoints';
import { createColors, ThemeColorsInputSchema } from './createColors';
import { createComponents } from './createComponents';
import { createShadows } from './createShadows';
import { createShape, ThemeShapeInputSchema } from './createShape';
import { createSpacing, ThemeSpacingOptionsSchema } from './createSpacing';
import { createTransitions } from './createTransitions';
import { createTypography, ThemeTypographyInputSchema } from './createTypography';
import { createV1Theme } from './createV1Theme';
import { createVisualizationColors, ThemeVisualizationColorsInputSchema } from './createVisualizationColors';
import { GrafanaTheme2 } from './types';
import { zIndex } from './zIndex';

export const NewThemeOptionsSchema = z.object({
  name: z.string(),
  id: z.string(),
  colors: ThemeColorsInputSchema.optional(),
  spacing: ThemeSpacingOptionsSchema.optional(),
  shape: ThemeShapeInputSchema.optional(),
  typography: ThemeTypographyInputSchema.optional(),
  visualization: ThemeVisualizationColorsInputSchema.optional(),
});

/** @internal */
export type NewThemeOptions = z.infer<typeof NewThemeOptionsSchema>;

/** @internal */
export function createTheme(
  options: Omit<NewThemeOptions, 'id' | 'name'> & {
    name?: NewThemeOptions['name'];
  } = {}
): GrafanaTheme2 {
  const {
    name,
    colors: colorsInput = {},
    spacing: spacingInput = {},
    shape: shapeInput = {},
    typography: typographyInput = {},
    visualization: visualizationInput = {},
  } = options;

  const colors = createColors(colorsInput);
  const breakpoints = createBreakpoints();
  const spacing = createSpacing(spacingInput);
  const shape = createShape(shapeInput);
  const typography = createTypography(colors, typographyInput);
  const shadows = createShadows(colors);
  const transitions = createTransitions();
  const components = createComponents(colors, shadows);
  const visualization = createVisualizationColors(colors, visualizationInput);

  const theme = {
    name: name ?? (colors.mode === 'dark' ? 'Dark' : 'Light'),
    isDark: colors.mode === 'dark',
    isLight: colors.mode === 'light',
    colors,
    breakpoints,
    spacing,
    shape,
    components,
    typography,
    shadows,
    transitions,
    visualization,
    zIndex: {
      ...zIndex,
    },
    flags: {},
  };

  return {
    ...theme,
    v1: createV1Theme(theme),
  };
}
