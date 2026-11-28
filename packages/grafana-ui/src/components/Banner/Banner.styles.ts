import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { getSvgSize } from '../Icon/utils';

/**
 * An opaque version of a banner background: the color without its alpha, mixed with black in dark themes or white
 * in light themes, keeping the color in proportion to its alpha. This approximates how a translucent background
 * looks on the page.
 */
export const getOpaqueBackgroundColor = (theme: GrafanaTheme2, color: string) => {
  const mixWithPage = (channel: string) =>
    theme.isDark ? `${channel} * alpha` : `${channel} * alpha + 255 * (1 - alpha)`;

  return `rgb(from ${color} calc(${mixWithPage('r')}) calc(${mixWithPage('g')}) calc(${mixWithPage('b')}) / 1)`;
};

interface BannerStyleOptions {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
  textColor: string;
  emphasisColor?: string;
  dismissIconColor?: string;
  elevated?: boolean;
  bottomSpacing?: number;
  topSpacing?: number;
  hasDismissIcon?: boolean;
  isCompact?: boolean;
}

export const getStyles = (
  theme: GrafanaTheme2,
  {
    backgroundColor,
    borderColor,
    iconColor,
    textColor,
    emphasisColor,
    dismissIconColor,
    elevated,
    bottomSpacing,
    topSpacing,
    hasDismissIcon,
    isCompact,
  }: BannerStyleOptions
) => {
  const visualRefreshEnabled = theme.flags.visualDesignRefresh;
  const emphasis = emphasisColor ?? `color-mix(in srgb, ${backgroundColor} 94%, ${iconColor} 6%)`;
  // The dismiss X is an xl IconButton: a 24px icon with a 32px hover fill. In the refresh themes the icon tile
  // takes that 32px size, and the X is padded to match it, so the two line up.
  const dismissIconSize = getSvgSize('xl');
  const tileSize = visualRefreshEnabled ? dismissIconSize + theme.spacing.gridSize : dismissIconSize;
  const dismissPadding = (tileSize - dismissIconSize) / 2;

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
    container: css(
      {
        display: 'flex',
        alignItems: 'stretch',
        gap: theme.spacing(2),
        backgroundColor,
        borderRadius: theme.shape.radius.lg,
        padding: theme.spacing(1, 2),
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor,
        boxShadow: elevated ? theme.shadows.z3 : undefined,
      },
      isCompact && {
        padding: theme.spacing(0.5, 1.5),
      },
      hasDismissIcon && {
        paddingRight: theme.spacing(1),
      }
    ),
    iconBox: css(
      {
        alignSelf: 'flex-start',
        display: 'inline-flex',
        borderRadius: theme.shape.radius.default,
      },
      visualRefreshEnabled && {
        backgroundColor: emphasis,
        width: tileSize,
        height: tileSize,
        alignItems: 'center',
        justifyContent: 'center',
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
    dismissButton: css(
      {
        padding: dismissPadding,
        margin: 0,
      },
      visualRefreshEnabled && {
        // IconButton paints its hover fill on ::before, not on the button.
        '&:hover:before': {
          backgroundColor: emphasis,
        },
      },
      dismissIconColor && {
        color: dismissIconColor,
      }
    ),
  };
};
