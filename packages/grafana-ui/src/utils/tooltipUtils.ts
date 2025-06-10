import { css } from '@emotion/css';
import { Placement } from '@floating-ui/react';

import { GrafanaTheme2 } from '@grafana/data';

import { TooltipPlacement } from '../components/Tooltip/types';

export function getPlacement(placement?: TooltipPlacement): Placement {
  switch (placement) {
    case 'auto':
      return 'bottom';
    case 'auto-start':
      return 'bottom-start';
    case 'auto-end':
      return 'bottom-end';
    default:
      return placement ?? 'bottom';
  }
}

export function buildTooltipTheme(
  theme: GrafanaTheme2,
  tooltipBg: string,
  toggletipBorder: string,
  tooltipText: string,
  tooltipPadding: { topBottom: number; rightLeft: number }
) {
  return {
    arrow: css({
      fill: tooltipBg,
    }),
    container: css({
      backgroundColor: tooltipBg,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${toggletipBorder}`,
      boxShadow: theme.shadows.z2,
      color: tooltipText,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(tooltipPadding.topBottom, tooltipPadding.rightLeft),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.3s',
      },
      zIndex: theme.zIndex.tooltip,
      maxWidth: '400px',
      overflowWrap: 'break-word',

      "&[data-popper-interactive='false']": {
        pointerEvents: 'none',
      },
    }),
    headerClose: css({
      color: theme.colors.text.secondary,
      position: 'absolute',
      right: theme.spacing(1),
      top: theme.spacing(1.5),
      backgroundColor: 'transparent',
      border: 0,
    }),
    header: css({
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    }),
    body: css({
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    }),
    footer: css({
      paddingTop: theme.spacing(2),
      paddingBottom: theme.spacing(1),
    }),
  };
}
