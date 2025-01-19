import { GrafanaTheme2 } from '@grafana/data';

const richColors = ['primary', 'secondary', 'info', 'error', 'success', 'warning'] as const;
/**
 * Creates CSS variables from the active Grafana theme.
 * @param theme The Grafana theme to extract variables from
 * @returns Object containing CSS variable declarations
 */
export function createGlobalCssVars(theme: GrafanaTheme2) {
  const vars: {
    [key: `--grafana-${'color' | 'gradient'}-${string}`]: string;
  } = {};

  // Process rich colors (primary, secondary, info, etc)
  for (const colorName of richColors) {
    const color = theme.colors[colorName];
    vars[`--grafana-color-${colorName}-main`] = color.main;
    vars[`--grafana-color-${colorName}-text`] = color.text;
    vars[`--grafana-color-${colorName}-border`] = color.border;
    vars[`--grafana-color-${colorName}-shade`] = color.shade;
    vars[`--grafana-color-${colorName}-transparent`] = color.transparent;
    vars[`--grafana-color-${colorName}-border-transparent`] = color.borderTransparent;
    vars[`--grafana-color-${colorName}-contrast-text`] = color.contrastText;
  }

  for (const [key, value] of Object.entries(theme.colors.text)) {
    vars[`--grafana-color-text-${key}`] = value;
  }

  for (const [key, value] of Object.entries(theme.colors.background)) {
    vars[`--grafana-color-bg-${key}`] = value;
  }

  for (const [key, value] of Object.entries(theme.colors.border)) {
    vars[`--grafana-color-border-${key}`] = value;
  }

  for (const [key, value] of Object.entries(theme.colors.action)) {
    if (typeof value === 'string') {
      vars[`--grafana-color-action-${key}`] = value;
    } else if (typeof value === 'number') {
      vars[`--grafana-color-action-${key}`] = value.toString();
    }
  }

  for (const [key, value] of Object.entries(theme.colors.gradients)) {
    vars[`--grafana-gradient-${key}`] = value;
  }

  vars['--grafana-color-hover-factor'] = theme.colors.hoverFactor.toString();
  vars['--grafana-color-contrast-threshold'] = theme.colors.contrastThreshold.toString();
  vars['--grafana-color-tonal-offset'] = theme.colors.tonalOffset.toString();

  return vars;
}
