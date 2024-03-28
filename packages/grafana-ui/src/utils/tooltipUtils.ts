import { css } from '@emotion/css';
import { Placement } from '@floating-ui/react';
import { Spacing } from 'src/saga-themes/code/themes/spacing';
import { GrafanaTheme3 } from 'src/saga-themes/createTheme';

import { colorManipulator } from '@grafana/data';

import { TooltipPlacement } from '../components/Tooltip';

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
  theme: GrafanaTheme3,
  tooltipBg: string,
  toggletipBorder: string,
  tooltipText: string,
  tooltipPadding: { topBottom: keyof Spacing; rightLeft: keyof Spacing }
) {
  return {
    arrow: css({
      fill: tooltipBg,
    }),
    container: css({
      backgroundColor: tooltipBg,
      borderRadius: theme.border.borderRadius.default,
      border: `1px solid ${toggletipBorder}`,
      boxShadow: theme.shadow.z2,
      color: tooltipText,
      font: theme.font.bodySmall,
      // TODO: Replace with new theme
      padding: theme.spacingFn(tooltipPadding.topBottom, tooltipPadding.rightLeft),
      transition: 'opacity 0.3s',
      zIndex: theme.zIndex.tooltip,
      maxWidth: '400px',
      overflowWrap: 'break-word',

      "&[data-popper-interactive='false']": {
        pointerEvents: 'none',
      },

      code: {
        border: 'none',
        display: 'inline',
        background: colorManipulator.darken(tooltipBg, 0.1),
        color: tooltipText,
        whiteSpace: 'normal',
      },

      pre: {
        background: colorManipulator.darken(tooltipBg, 0.1),
        color: tooltipText,
      },

      a: {
        color: tooltipText,
        textDecoration: 'underline',
      },

      'a:hover': {
        textDecoration: 'none',
      },
    }),
    headerClose: css({
      color: theme.color.content.secondary,
      position: 'absolute',
      right: theme.spacing[100],
      top: theme.spacing[150],
      backgroundColor: 'transparent',
      border: 0,
    }),
    header: css({
      paddingTop: theme.spacing[100],
      paddingBottom: theme.spacing[200],
    }),
    body: css({
      paddingTop: theme.spacing[100],
      paddingBottom: theme.spacing[100],
    }),
    footer: css({
      paddingTop: theme.spacing[200],
      paddingBottom: theme.spacing[100],
    }),
  };
}
