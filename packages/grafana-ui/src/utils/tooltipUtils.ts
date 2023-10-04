import { css } from '@emotion/css';

import { colorManipulator, GrafanaTheme2 } from '@grafana/data';

export function buildTooltipTheme(
  theme: GrafanaTheme2,
  tooltipBg: string,
  toggletipBorder: string,
  tooltipText: string,
  tooltipPadding: { topBottom: number; rightLeft: number }
) {
  return {
    arrow: css({
      height: '1rem',
      width: '1rem',
      position: 'absolute',
      pointerEvents: 'none',

      '&::before': {
        borderStyle: 'solid',
        content: '""',
        display: 'block',
        height: 0,
        margin: 'auto',
        width: 0,
      },

      '&::after': {
        borderStyle: 'solid',
        content: '""',
        display: 'block',
        height: 0,
        margin: 'auto',
        position: 'absolute',
        width: 0,
      },
    }),
    container: css({
      backgroundColor: tooltipBg,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${toggletipBorder}`,
      boxShadow: theme.shadows.z2,
      color: tooltipText,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: theme.spacing(tooltipPadding.topBottom, tooltipPadding.rightLeft),
      transition: 'opacity 0.3s',
      zIndex: theme.zIndex.tooltip,
      maxWidth: '400px',
      overflowWrap: 'break-word',

      "&[data-popper-interactive='false']": {
        pointerEvents: 'none',
      },

      "&[data-popper-placement*='bottom'] > div[data-popper-arrow='true']": {
        left: 0,
        marginTop: '-7px',
        top: 0,

        '&::before': {
          borderColor: `transparent transparent ${toggletipBorder} transparent`,
          borderWidth: '0 8px 7px 8px',
          position: 'absolute',
          top: '-1px',
        },

        '&::after': {
          borderColor: `transparent transparent ${tooltipBg} transparent`,
          borderWidth: '0 8px 7px 8px',
        },
      },

      "&[data-popper-placement*='top'] > div[data-popper-arrow='true']": {
        bottom: 0,
        left: 0,
        marginBottom: '-14px',

        '&::before': {
          borderColor: `${toggletipBorder} transparent transparent transparent`,
          borderWidth: '7px 8px 0 7px',
          position: 'absolute',
          top: '1px',
        },

        '&::after': {
          borderColor: `${tooltipBg} transparent transparent transparent`,
          borderWidth: '7px 8px 0 7px',
        },
      },

      "&[data-popper-placement*='right'] > div[data-popper-arrow='true']": {
        left: 0,
        marginLeft: '-10px',

        '&::before': {
          borderColor: `transparent ${toggletipBorder} transparent transparent`,
          borderWidth: '7px 6px 7px 0',
        },

        '&::after': {
          borderColor: `transparent ${tooltipBg} transparent transparent`,
          borderWidth: '6px 7px 7px 0',
          left: '2px',
          top: '1px',
        },
      },

      "&[data-popper-placement*='left'] > div[data-popper-arrow='true']": {
        marginRight: '-11px',
        right: 0,

        '&::before': {
          borderColor: `transparent transparent transparent ${toggletipBorder}`,
          borderWidth: '7px 0 6px 7px',
        },

        '&::after': {
          borderColor: `transparent transparent transparent ${tooltipBg}`,
          borderWidth: '6px 0 5px 5px',
          left: '1px',
          top: '1px',
        },
      },

      code: {
        border: 'none',
        display: 'inline',
        background: colorManipulator.darken(tooltipBg, 0.1),
        color: tooltipText,
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
