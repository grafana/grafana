import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export function getModalStyles(theme: GrafanaTheme2) {
  return {
    myTable: css`
      max-height: 204px;
      overflow-y: auto;
      margin-top: 11px;
      margin-bottom: 28px;
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.action.hover};
      background: ${theme.colors.background.primary};
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.h6.fontSize};
      width: 100%;

      thead {
        color: #538ade;
        font-size: ${theme.typography.bodySmall.fontSize};
      }

      th,
      td {
        padding: 6px 13px;
        height: ${theme.spacing(4)};
      }

      tbody > tr:nth-child(odd) {
        background: ${theme.colors.background.secondary};
      }
    `,
    noteTextbox: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    textInfo: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.size.sm};
    `,
    dashboardSearch: css`
      margin-top: ${theme.spacing(2)};
    `,
    modal: css`
      width: 500px;
    `,
    modalText: css`
      font-size: ${theme.typography.h4.fontSize};
      color: ${theme.colors.text.primary};
      margin-bottom: ${theme.spacing(4)};
      padding-top: ${theme.spacing(2)};
    `,
  };
}
