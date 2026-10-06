import { type GrafanaTheme2 } from '@grafana/data';

import { type ThemeVariables } from './protocol';

/** The theme as the --gf-* CSS custom properties the frame sets on :root. It never carries functions. */
export function serializeTheme(theme: GrafanaTheme2): ThemeVariables {
  const { colors, typography, visualization } = theme;
  const vars: Record<string, string> = {
    '--gf-color-text-primary': colors.text.primary,
    '--gf-color-text-secondary': colors.text.secondary,
    '--gf-color-text-disabled': colors.text.disabled,
    '--gf-color-text-link': colors.text.link,
    '--gf-color-bg-canvas': colors.background.canvas,
    '--gf-color-bg-primary': colors.background.primary,
    '--gf-color-bg-secondary': colors.background.secondary,
    '--gf-color-border-weak': colors.border.weak,
    '--gf-color-border-medium': colors.border.medium,
    '--gf-color-border-strong': colors.border.strong,
    '--gf-color-primary': colors.primary.main,
    '--gf-color-primary-contrast': colors.primary.contrastText,
    '--gf-color-success': colors.success.main,
    '--gf-color-warning': colors.warning.main,
    '--gf-color-error': colors.error.main,
    '--gf-color-info': colors.info.main,
    '--gf-font-family': typography.fontFamily,
    '--gf-font-family-mono': typography.fontFamilyMonospace,
    '--gf-font-size': `${typography.fontSize}px`,
    '--gf-font-size-sm': typography.bodySmall.fontSize,
    '--gf-spacing': `${theme.spacing.gridSize}px`,
    '--gf-radius': theme.shape.radius.default,
  };
  visualization.palette.forEach((color, i) => {
    vars[`--gf-palette-${i}`] = visualization.getColorByName(color);
  });
  return { colorScheme: theme.isLight ? 'light' : 'dark', vars };
}
