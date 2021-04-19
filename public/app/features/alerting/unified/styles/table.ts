import { GrafanaTheme } from '@grafana/data';
import { css } from '@emotion/css';

export const getAlertTableStyles = (theme: GrafanaTheme) => ({
  table: css`
    width: 100%;
    border-radius: ${theme.border.radius.sm};
    border: solid 1px ${theme.colors.border3};
    background-color: ${theme.colors.bg2};

    th {
      padding: ${theme.spacing.sm};
    }

    td {
      padding: 0 ${theme.spacing.sm};
    }

    tr {
      height: 38px;
    }
  `,
  evenRow: css`
    background-color: ${theme.colors.bodyBg};
  `,
  colExpand: css`
    width: 36px;
  `,
  actionsCell: css`
    text-align: right;
    width: 1%;
    white-space: nowrap;

    & > * + * {
      margin-left: ${theme.spacing.sm};
    }
  `,
});
