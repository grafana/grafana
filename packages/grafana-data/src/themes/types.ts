import { GrafanaTheme } from '../types/theme';
import { ThemeBreakpoints } from './breakpoints';
import { ThemeComponents } from './createComponents';
import { ThemeColors } from './createColors';
import { ThemeShadows } from './createShadows';
import { ThemeShape } from './createShape';
import { ThemeSpacing } from './createSpacing';
import { ThemeTransitions } from './createTransitions';
import { ThemeTypography } from './createTypography';
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
  transitions: ThemeTransitions;
  v1: GrafanaTheme;
}

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
  /** Text color for text ontop of main */
  contrastText: string;
}

/** @internal */
export type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};
