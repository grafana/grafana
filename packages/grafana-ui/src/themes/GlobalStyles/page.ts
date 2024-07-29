import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getPageStyles(theme: GrafanaTheme2) {
  const maxWidthBreakpoint =
    theme.breakpoints.values.xxl + theme.spacing.gridSize * 2 + theme.components.sidemenu.width;
  const isBodyScrolling = window.grafanaBootData?.settings.featureToggles.bodyScrolling;

  return css({
    '.grafana-app': isBodyScrolling
      ? {
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
        }
      : {
          display: 'flex',
          alignItems: 'stretch',
          position: 'absolute',
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
        },

    '.main-view': isBodyScrolling
      ? {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          position: 'relative',
          minWidth: 0,
        }
      : {
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
          flex: '1 1 0',
          minWidth: 0,
        },

    '.page-scrollbar-content': {
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
    },

    '.page-container': {
      flexGrow: 1,
      flexBasis: '100%',
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),

      [theme.breakpoints.up('sm')]: {
        margin: theme.spacing(0, 1),
      },

      [theme.breakpoints.up('md')]: {
        margin: theme.spacing(0, 2),
      },

      [`@media (min-width: ${maxWidthBreakpoint}px)`]: {
        maxWidth: `${theme.breakpoints.values.xxl}px`,
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
      },
    },

    '.page-full': {
      marginLeft: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(2),
    },

    '.page-body': {
      padding: theme.spacing(1),
      background: theme.components.panel.background,
      border: `1px solid ${theme.components.panel.borderColor}`,
      marginBottom: '32px',

      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(2),
      },

      [theme.breakpoints.up('lg')]: {
        padding: theme.spacing(3),
      },
    },

    '.page-heading': {
      fontSize: theme.typography.h4.fontSize,
      marginTop: 0,
      marginBottom: theme.spacing(2),
    },

    '.page-action-bar': {
      marginBottom: theme.spacing(2),
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(2),
    },

    '.page-action-bar--narrow': {
      marginBottom: 0,
    },

    '.page-action-bar__spacer': {
      width: theme.spacing(2),
      flexGrow: 1,
    },

    '.page-sub-heading': {
      marginBottom: theme.spacing(2),
    },

    '.page-sub-heading-icon': {
      marginLeft: theme.spacing(1),
      marginTop: theme.spacing(0.5),
    },

    '.page-hidden': {
      display: 'none',
    },
  });
}
