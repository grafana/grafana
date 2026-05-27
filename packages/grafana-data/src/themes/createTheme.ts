import { createBreakpoints } from './breakpoints';
import { createColors } from './createColors';
import { createComponents } from './createComponents';
import { createShadows } from './createShadows';
import { createShape } from './createShape';
import { createSpacing } from './createSpacing';
import { createTransitions } from './createTransitions';
import { createTypography } from './createTypography';
import { createV1Theme } from './createV1Theme';
import { createVisualizationColors } from './createVisualizationColors';
import { type GrafanaTheme2 } from './types';
import { type NewThemeOptions } from './types/schema.mts';
import { zIndex } from './zIndex';

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
