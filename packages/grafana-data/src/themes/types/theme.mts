import { type ThemeBreakpoints } from './breakpoints.mts';
import { type ThemeVisualizationColors, type ThemeColors } from './color.mts';
import { type ThemeComponents } from './components.mts';
import { type ThemeShadows } from './shadows.mts';
import { type ThemeShape } from './shape.mts';
import { type ThemeSpacing } from './spacing.mts';
import { type ThemeTypography } from './typography.mts';
import { type ThemeZIndices } from './zIndex.mts';
import { type GrafanaTheme } from '../../types/theme.ts';
import { type ThemeTransitions } from './transitions.mts';

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
