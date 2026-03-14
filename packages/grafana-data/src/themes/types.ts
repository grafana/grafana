import { object, optional, string as vString } from 'valibot';

import { GrafanaTheme } from '../types/theme';

import { ThemeBreakpoints } from './breakpoints';
import { ThemeColors } from './createColors';
import { ThemeComponents } from './createComponents';
import { ThemeShadows } from './createShadows';
import { ThemeShape } from './createShape';
import { ThemeSpacing } from './createSpacing';
import { ThemeTransitions } from './createTransitions';
import { ThemeTypography } from './createTypography';
import { ThemeVisualizationColors } from './createVisualizationColors';
import { ThemeZIndices } from './zIndex';

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

export const ThemeRichColorInputSchema = object({
  /** color intent (primary, secondary, info, error, etc) */
  name: optional(vString()),
  /** Main color */
  main: optional(vString()),
  /** Used for hover */
  shade: optional(vString()),
  /** Used for text */
  text: optional(vString()),
  /** Used for borders */
  border: optional(vString()),
  /** Used subtly colored backgrounds */
  transparent: optional(vString()),
  /** Used for weak colored borders like larger alert/banner boxes and smaller badges and tags */
  borderTransparent: optional(vString()),
  /** Text color for text ontop of main */
  contrastText: optional(vString()),
});

/** @alpha */
export interface ThemeRichColor {
  /** color intent (primary, secondary, info, error, etc) */
  name: string;
  /** Main color */
  main: string;
  /** Used for hover */
  shade: string;
  /** Used for text */
  text: string;
  /** Used for borders */
  border: string;
  /** Used subtly colored backgrounds */
  transparent: string;
  /** Used for weak colored borders like larger alert/banner boxes and smaller badges and tags */
  borderTransparent: string;
  /** Text color for text ontop of main */
  contrastText: string;
}

/** @internal */
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

/** @internal */
export type DeepRequired<T> = Required<{
  [P in keyof T]: T[P] extends Required<T[P]> ? T[P] : DeepRequired<T[P]>;
}>;
