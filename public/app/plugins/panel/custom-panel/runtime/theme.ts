import { type GrafanaTheme2 } from '@grafana/data';

import { type ThemeSnapshot } from './protocol';

/** A plain-data copy of the theme for the frame. It never carries functions. */
export function serializeTheme(theme: GrafanaTheme2): ThemeSnapshot {
  const { colors, typography, visualization } = theme;
  return {
    mode: theme.isLight ? 'light' : 'dark',
    colors: {
      text: {
        primary: colors.text.primary,
        secondary: colors.text.secondary,
        disabled: colors.text.disabled,
        link: colors.text.link,
      },
      background: {
        canvas: colors.background.canvas,
        primary: colors.background.primary,
        secondary: colors.background.secondary,
      },
      border: { weak: colors.border.weak, medium: colors.border.medium, strong: colors.border.strong },
      primary: { main: colors.primary.main, text: colors.primary.text, contrastText: colors.primary.contrastText },
      success: { main: colors.success.main, text: colors.success.text },
      warning: { main: colors.warning.main, text: colors.warning.text },
      error: { main: colors.error.main, text: colors.error.text },
      info: { main: colors.info.main, text: colors.info.text },
    },
    palette: visualization.palette.map((color) => visualization.getColorByName(color)),
    typography: {
      fontFamily: typography.fontFamily,
      fontFamilyMonospace: typography.fontFamilyMonospace,
      fontSize: typography.fontSize,
      bodySmallFontSize: typography.bodySmall.fontSize,
    },
    spacingGridSize: theme.spacing.gridSize,
    borderRadius: theme.shape.radius.default,
  };
}
