import { classicColors, type GrafanaTheme2 } from '@grafana/data';

export interface PreviewThemeTokens {
  panelBackground: string;
  panelBorder: string;
  panelText: string;
  panelTextSecondary: string;
  gridLine: string;
  primary: string;
  buttonTextOnAccent: string;
  seriesPalette: string[];
  /** Multiplier applied to body text sizes, derived from typography.fontSize. */
  textScale: number;
  /** Panel padding in px, derived from the theme spacing scale. */
  panelPadding: number;
}

const getSeriesPalette = (primary: string) => {
  return [primary, ...classicColors].slice(0, 6);
};

/** Flatten a derived GrafanaTheme2 into the tokens the preview panels consume. */
export const getPreviewTheme = (theme: GrafanaTheme2): PreviewThemeTokens => {
  const primary = theme.colors.primary.main;

  return {
    panelBackground: theme.components.panel.background,
    panelBorder: theme.components.panel.borderColor,
    panelText: theme.colors.text.primary,
    panelTextSecondary: theme.colors.text.secondary,
    gridLine: theme.colors.border.weak,
    primary,
    buttonTextOnAccent: theme.colors.primary.contrastText,
    seriesPalette: getSeriesPalette(primary),
    textScale: theme.typography.fontSize / 14,
    panelPadding: theme.spacing.gridSize * 2,
  };
};
