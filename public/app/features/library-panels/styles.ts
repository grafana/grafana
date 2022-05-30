import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export function getModalStyles(theme: GrafanaTheme) {
  return {
    myTable: css`
      max-height: 204px;
      overflow-y: auto;
      margin-top: 11px;
      margin-bottom: 28px;
      border-radius: ${theme.border.radius.sm};
      border: 1px solid ${theme.colors.bg3};
      background: ${theme.colors.bg1};
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.md};
      width: 100%;

      thead {
        color: #538ade;
        font-size: ${theme.typography.size.sm};
      }

      th,
      td {
        padding: 6px 13px;
        height: ${theme.spacing.xl};
      }

      tbody > tr:nth-child(odd) {
        background: ${theme.colors.bg2};
      }
    `,
    noteTextbox: css`
      margin-bottom: ${theme.spacing.xl};
    `,
    textInfo: css`
      color: ${theme.colors.textSemiWeak};
      font-size: ${theme.typography.size.sm};
    `,
    dashboardSearch: css`
      margin-top: ${theme.spacing.md};
    `,
    modal: css`
      width: 500px;
    `,
    modalText: css`
      font-size: ${theme.typography.heading.h4};
      color: ${theme.colors.link};
      margin-bottom: calc(${theme.spacing.d} * 2);
      padding-top: ${theme.spacing.d};
    `,
  };
}
