import * as z from 'zod/mini';

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
    /**
     * Use tabular numerals for visualization legend and tooltip values.
     * @internal
     */
    tabularNums?: boolean;
  } & Record<string, boolean | undefined>;
}

export const ThemeRichColorInputSchema = z.object({
  /** color intent (primary, secondary, info, error, etc) */
  name: z.optional(z.enum(['primary', 'secondary', 'tertiary', 'accent', 'info', 'success', 'error', 'warning'])),

  /** Main color */
  main: z.optional(z.string()),
  /** Used for hover/focus/active states */
  mainEmphasis: z.optional(z.string()),
  /** Used for background */
  background: z.optional(z.string()),
  /** Used for background hover/focus/active states */
  backgroundEmphasis: z.optional(z.string()),
  /** Used for text. Can sit on top of the relevant ThemeRichColor subtleBackground, or a standard background. */
  text: z.optional(z.string()),
  /** Used for text hover/focus/active states */
  textEmphasis: z.optional(z.string()),
  /** Used for borders */
  border: z.optional(z.string()),
  /** Used for border hover/focus/active states */
  borderEmphasis: z.optional(z.string()),
  /** Text color for text ontop of main */
  contrastText: z.optional(z.string()),
  /** A more subtle alternative to `background`, for surfaces that shouldn't match a solid-fill button */
  subtleBackground: z.optional(z.string()),
  /** A more subtle alternative to `border`, for surfaces that shouldn't match a solid-fill button */
  subtleBorder: z.optional(z.string()),
  /**
   * Used for hover
   * @deprecated use `mainEmphasis` instead
   */
  shade: z.optional(z.string()),
  /**
   * Used subtly colored backgrounds
   * @deprecated use `background` instead
   */
  transparent: z.optional(z.string()),
  /**
   * Used for weak colored borders like larger alert/banner boxes and smaller badges and tags
   * @deprecated use `border` instead
   */
  borderTransparent: z.optional(z.string()),
});

const ThemeRichColorSchema = z.required(ThemeRichColorInputSchema);

/** @alpha */
export type ThemeRichColor = z.infer<typeof ThemeRichColorSchema>;

/** @internal */
export type DeepRequired<T> = Required<{
  [P in keyof T]: T[P] extends Required<T[P]> ? T[P] : DeepRequired<T[P]>;
}>;
