import { classicColors, type GrafanaTheme2 } from '@grafana/data';

export interface PreviewThemeTokens {
  dashboardBackground: string;
  dashboardText: string;
  panelBackground: string;
  panelBorder: string;
  panelText: string;
  panelTextSecondary: string;
  mutedSurface: string;
  gridLine: string;
  primary: string;
  buttonTextOnAccent: string;
  success: string;
  warning: string;
  error: string;
  seriesPalette: string[];
  /** Multiplier applied to body text sizes, derived from typography.fontSize. */
  textScale: number;
  /** Multiplier applied to panel titles. */
  headingScale: number;
  /** Panel padding in px, derived from the theme spacing scale. */
  panelPadding: number;
}

const getSeriesPalette = (primary: string) => {
  return [primary, ...classicColors].slice(0, 6);
};

/**
 * Map a derived GrafanaTheme2 (built from the studio's NewThemeOptions) into the flat tokens the
 * preview panels consume. Going through createTheme resolves palette references and defaults so the
 * preview reflects the real theme, not just the raw overrides.
 */
export const getPreviewTheme = (theme: GrafanaTheme2): PreviewThemeTokens => {
  const primary = theme.colors.primary.main;

  return {
    dashboardBackground: theme.colors.background.canvas,
    dashboardText: theme.colors.text.primary,
    panelBackground: theme.components.panel.background,
    panelBorder: theme.components.panel.borderColor,
    panelText: theme.colors.text.primary,
    panelTextSecondary: theme.colors.text.secondary,
    mutedSurface: theme.colors.background.secondary,
    gridLine: theme.colors.border.weak,
    primary,
    buttonTextOnAccent: theme.colors.primary.contrastText,
    success: theme.colors.success.main,
    warning: theme.colors.warning.main,
    error: theme.colors.error.main,
    seriesPalette: getSeriesPalette(primary),
    textScale: theme.typography.fontSize / 14,
    headingScale: 1,
    panelPadding: theme.spacing.gridSize * 2,
  };
};
