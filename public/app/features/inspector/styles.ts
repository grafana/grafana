import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';

/** @deprecated */
export const getPanelInspectorStyles = stylesFactory(() => {
  return getPanelInspectorStyles2(config.theme2);
});

export const getPanelInspectorStyles2 = (theme: GrafanaTheme2) => {
  return {
    wrap: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      flex: 1 1 0;
      min-height: 0;
    `,
    toolbar: css`
      display: flex;
      width: 100%;
      flex-grow: 0;
      align-items: center;
      justify-content: flex-end;
      margin-bottom: ${theme.v1.spacing.sm};
    `,
    toolbarItem: css`
      margin-left: ${theme.v1.spacing.md};
    `,
    content: css`
      flex-grow: 1;
      height: 100%;
    `,
    editor: css`
      font-family: monospace;
      height: 100%;
      flex-grow: 1;
    `,
    viewer: css`
      overflow: scroll;
    `,
    dataFrameSelect: css`
      flex-grow: 2;
    `,
    leftActions: css`
      display: flex;
      flex-grow: 1;

      max-width: 85%;
      @media (max-width: 1345px) {
        max-width: 75%;
      }
    `,
    options: css`
      padding-top: ${theme.v1.spacing.sm};
    `,
    dataDisplayOptions: css`
      flex-grow: 1;
      min-width: 300px;
      margin-right: ${theme.v1.spacing.sm};
    `,
    selects: css`
      display: flex;
      > * {
        margin-right: ${theme.v1.spacing.sm};
      }
    `,
  };
};
