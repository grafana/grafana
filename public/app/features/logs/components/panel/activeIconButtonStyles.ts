import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

/**
 * Shared box for log-details icon buttons.
 * The brand line is on `:after` because IconButton already uses `:before` for its hover plate.
 */
export function getIconButtonStyles(theme: GrafanaTheme2) {
  const background = theme.flags.visualDesignRefresh ? theme.colors.secondary.background : theme.colors.secondary.main;
  const backgroundHover = theme.flags.visualDesignRefresh
    ? theme.colors.secondary.backgroundEmphasis
    : theme.colors.secondary.shade;

  return {
    iconButton: css({
      '&&': {
        border: '1px solid transparent',
        borderRadius: theme.shape.radius.default,
        padding: theme.spacing(0.5),
        margin: 0,
      },
    }),
    activeIconButton: css({
      '&&': {
        color: theme.colors.text.primary,
        background,
        borderColor: theme.colors.secondary.subtleBorder,
      },
      '&&:hover': {
        color: theme.colors.text.primary,
        background: backgroundHover,
        borderColor: theme.colors.secondary.border,
      },
      '&&:before, &&:hover:before': {
        backgroundColor: 'transparent',
        opacity: 0,
      },
      '&&:after': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        left: 0,
        right: 0,
        height: '2px',
        bottom: 0,
        borderRadius: theme.shape.radius.default,
        backgroundImage: theme.colors.gradients.brandHorizontal,
      },
    }),
  };
}
