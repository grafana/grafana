import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getPageStyles(theme: GrafanaTheme2) {
  const maxWidthBreakpoint =
    theme.breakpoints.values.xxl + theme.spacing.gridSize * 2 + theme.components.sidemenu.width;

  return css`
    .grafana-app {
      display: flex;
      align-items: stretch;
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
    }

    .main-view {
      position: relative;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      height: 100%;
      flex: 1 1 0;
      min-width: 0;
    }

    .page-scrollbar-content {
      display: flex;
      min-height: 100%;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }

    .page-container {
      flex-grow: 1;
      flex-basis: 100%;
      padding-left: ${theme.spacing(2)};
      padding-right: ${theme.spacing(2)};

      ${theme.breakpoints.up('sm')} {
        margin: ${theme.spacing(0, 1)};
      }

      ${theme.breakpoints.up('md')} {
        margin: ${theme.spacing(0, 2)};
      }

      @media (min-width: ${maxWidthBreakpoint}px) {
        max-width: ${theme.breakpoints.values.xxl}px;
        margin-left: auto;
        margin-right: auto;
        width: 100%;
      }
    }

    .page-full {
      margin-left: ${theme.spacing(2)};
      padding-left: ${theme.spacing(2)};
      padding-right: ${theme.spacing(2)};
    }

    .page-body {
      padding: ${theme.spacing(1)};
      background: ${theme.components.panel.background};
      border: 1px solid ${theme.components.panel.borderColor};
      margin-bottom: 32px;

      ${theme.breakpoints.up('md')} {
        padding: ${theme.spacing(2)};
      }

      ${theme.breakpoints.up('lg')} {
        padding: ${theme.spacing(3)};
      }
    }

    .page-heading {
      font-size: ${theme.typography.h4.fontSize};
      margin-top: 0;
      margin-bottom: ${theme.spacing(2)};
    }

    .page-action-bar {
      margin-bottom: ${theme.spacing(2)};
      display: flex;
      align-items: flex-start;
      gap: ${theme.spacing(2)};
    }

    .page-action-bar--narrow {
      margin-bottom: 0;
    }

    .page-action-bar__spacer {
      width: ${theme.spacing(2)};
      flex-grow: 1;
    }

    .page-sub-heading {
      margin-bottom: ${theme.spacing(2)};
    }

    .page-sub-heading-icon {
      margin-left: ${theme.spacing(1)};
      margin-top: ${theme.spacing(0.5)};
    }

    .page-hidden {
      display: none;
    }
  `;
}
