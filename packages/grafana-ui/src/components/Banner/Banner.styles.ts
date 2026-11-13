import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export const getStyles = (
  theme: GrafanaTheme2,
  backgroundColor: string,
  borderColor: string,
  iconColor: string,
  textColor: string,
  elevated?: boolean,
  bottomSpacing?: number,
  topSpacing?: number
) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;

  return {
    wrapper: css({
      flexGrow: 1,
      marginBottom: theme.spacing(bottomSpacing ?? 2),
      marginTop: theme.spacing(topSpacing ?? 0),
      position: 'relative',

      '&:before': {
        content: '""',
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        background: theme.colors.background.primary,
        borderRadius: theme.shape.radius.lg,
        zIndex: -1,
      },
    }),
    container: css({
      display: 'flex',
      alignItems: 'stretch',
      backgroundColor,
      borderRadius: theme.shape.radius.lg,
      padding: theme.spacing(1, 2),
      borderStyle: 'solid',
      borderWidth: '1px',
      borderColor,
      boxShadow: elevated ? theme.shadows.z3 : undefined,
    }),
    iconBox: css(
      {
        alignSelf: 'flex-start',
        display: 'inline-flex',
        borderRadius: theme.shape.radius.default,
      },
      visualRefreshEnabled && {
        backgroundColor: `color-mix(in srgb, ${backgroundColor} 94%, ${iconColor} 6%)`,
        padding: theme.spacing(1),
      }
    ),
    icon: css(
      {
        color: iconColor,
      },
      !visualRefreshEnabled && {
        position: 'relative',
        top: '-1px',
      }
    ),
    title: css({
      color: textColor,
    }),
    content: css({
      color: textColor,
      maxHeight: '50vh',
      overflowY: 'auto',
    }),
    close: css(
      {
        position: 'relative',
        color: theme.colors.text.secondary,
        background: 'none',
        display: 'flex',
        top: '-6px',
        right: '-14px',
      },
      visualRefreshEnabled && {
        button: {
          '&:hover, &:focus': {
            backgroundColor: `color-mix(in srgb, ${backgroundColor} 94%, ${iconColor} 6%)`,
          },
        },
      }
    ),
  };
};
