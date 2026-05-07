import { z } from 'zod';

import { type GrafanaTheme } from '../types/theme';

import { type ThemeBreakpoints } from './breakpoints';
import { type ThemeColors } from './createColors';
import { type ThemeComponents } from './createComponents';
import { type ThemeShadows } from './createShadows';
import { type ThemeShape } from './createShape';
import { type ThemeSpacing } from './createSpacing';
import { type ThemeTransitions } from './createTransitions';
import { type ThemeTypography } from './createTypography';
import { type ThemeVisualizationColors } from './createVisualizationColors';
import { type ThemeZIndices } from './zIndex';

/**
 * @beta
 * Next gen theme model introduced in Grafana v8.
 */
export interface GrafanaTheme2 {
  name: string;
  isDark: boolean;
  isLight: boolean;
  colors: ThemeColors;
  breakpoints: ThemeBreakpoints;
  spacing: ThemeSpacing;
  shape: ThemeShape;
  components: ThemeComponents;
  typography: ThemeTypography;
  zIndex: ThemeZIndices;
  shadows: ThemeShadows;
  visualization: ThemeVisualizationColors;
  transitions: ThemeTransitions;
  /** @deprecated Will be removed in a future version */
  v1: GrafanaTheme;
  /** feature flags that might impact component looks */
  flags: {};
}

export const ThemeRichColorInputSchema = z.object({
  /** color intent (primary, secondary, info, error, etc) */
  name: z.string().optional(),
  /** Main color */
  main: z.string().optional(),
  /** Used for hover */
  shade: z.string().optional(),
  /** Used for text */
  text: z.string().optional(),
  /** Used for borders */
  border: z.string().optional(),
  /** Used subtly colored backgrounds */
  transparent: z.string().optional(),
  /** Used for weak colored borders like larger alert/banner boxes and smaller badges and tags */
  borderTransparent: z.string().optional(),
  /** Text color for text ontop of main */
  contrastText: z.string().optional(),
});

export const ThemeRichColorSchema = ThemeRichColorInputSchema.required();

/** @alpha */
export type ThemeRichColor = z.infer<typeof ThemeRichColorSchema>;

/** @internal */
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

/** @internal */
export type DeepRequired<T> = Required<{
  [P in keyof T]: T[P] extends Required<T[P]> ? T[P] : DeepRequired<T[P]>;
}>;
