import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getDashboardGridStyles(theme: GrafanaTheme2) {
  return css({
    '.react-resizable-handle': {
      // this needs to use visibility and not display none in order not to cause resize flickering
      visibility: 'hidden',
    },

    '.react-grid-item, #grafana-portal-container': {
      touchAction: 'initial !important',

      '&:hover': {
        '.react-resizable-handle': {
          visibility: 'visible',
        },
      },
    },

    [theme.breakpoints.down('md')]: {
      '.react-grid-layout': {
        height: 'unset !important',
      },
      '.react-grid-item': {
        display: 'block !important',
        transitionProperty: 'none !important',
        // can't avoid type assertion here due to !important
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        position: 'unset !important' as 'unset',
        transform: 'translate(0px, 0px) !important',
        marginBottom: theme.spacing(2),
      },
      '.panel-repeater-grid-item': {
        height: 'auto !important',
      },
    },

    '.react-grid-item.react-grid-placeholder': {
      boxShadow: `0 0 4px ${theme.colors.primary.border} !important`,
      background: `${theme.colors.primary.transparent} !important`,
      zIndex: '-1 !important',
      opacity: 'unset !important',
    },

    '.react-grid-item > .react-resizable-handle::after': {
      borderRight: `2px solid ${theme.isDark ? theme.v1.palette.gray1 : theme.v1.palette.gray3} !important`,
      borderBottom: `2px solid ${theme.isDark ? theme.v1.palette.gray1 : theme.v1.palette.gray3} !important`,
    },

    // Hack for preventing panel menu overlapping.
    '.react-grid-item.resizing.panel, .react-grid-item.panel.dropdown-menu-open, .react-grid-item.react-draggable-dragging.panel':
      {
        zIndex: theme.zIndex.dropdown,
      },

    // Disable animation on initial rendering and enable it when component has been mounted.
    '.react-grid-item.cssTransforms': {
      transitionProperty: 'none !important',
    },

    [theme.transitions.handleMotion('no-preference')]: {
      '.react-grid-layout--enable-move-animations': {
        '.react-grid-item.cssTransforms': {
          transitionProperty: 'transform !important',
        },
      },
    },

    '.dashboard-selected-element': {
      outline: `2px dashed ${theme.colors.primary.border}`,
      outlineOffset: '0px',
      borderRadius: '2px',
    },
  });
}
