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
  flags: {
    /**
     * @internal
     */
    visualDesignRefresh?: boolean;
  };
}

export const ThemeRichColorInputSchema = z.object({
  /** color intent (primary, secondary, info, error, etc) */
  name: z.enum(['primary', 'secondary', 'tertiary', 'accent', 'info', 'success', 'error', 'warning']).optional(),

  /** Main color */
  main: z.string().optional(),
  /** Used for hover/focus/active states */
  mainEmphasis: z.string().optional(),
  /** Used for background */
  background: z.string().optional(),
  /** Used for background hover/focus/active states */
  backgroundEmphasis: z.string().optional(),
  /** Used for text. Can sit on top of the relevant ThemeRichColor background, or a standard background. */
  text: z.string().optional(),
  /** Used for text hover/focus/active states */
  textEmphasis: z.string().optional(),
  /** Used for borders */
  border: z.string().optional(),
  /** Used for border hover/focus/active states */
  borderEmphasis: z.string().optional(),
  /** Text color for text ontop of main */
  contrastText: z.string().optional(),

  /**
   * Used for hover
   * @deprecated use `mainEmphasis` instead
   */
  shade: z.string().optional(),
  /**
   * Used subtly colored backgrounds
   * @deprecated use `background` instead
   */
  transparent: z.string().optional(),
  /**
   * Used for weak colored borders like larger alert/banner boxes and smaller badges and tags
   * @deprecated use `border` instead
   */
  borderTransparent: z.string().optional(),
});

const ThemeRichColorSchema = ThemeRichColorInputSchema.required();

/** @alpha */
export type ThemeRichColor = z.infer<typeof ThemeRichColorSchema>;

/** @internal */
export type DeepRequired<T> = Required<{
  [P in keyof T]: T[P] extends Required<T[P]> ? T[P] : DeepRequired<T[P]>;
}>;
