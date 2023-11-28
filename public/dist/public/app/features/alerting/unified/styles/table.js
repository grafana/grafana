import { css } from '@emotion/css';
export const getAlertTableStyles = (theme) => ({
    table: css `
    width: 100%;
    border-radius: ${theme.shape.radius.default};
    border: solid 1px ${theme.colors.border.weak};
    background-color: ${theme.colors.background.secondary};

    th {
      padding: ${theme.spacing(1)};
    }

    td {
      padding: 0 ${theme.spacing(1)};
    }

    tr {
      height: 38px;
    }
  `,
    evenRow: css `
    background-color: ${theme.colors.background.primary};
  `,
    colExpand: css `
    width: 36px;
  `,
    nameCell: css `
    gap: ${theme.spacing(1)};
  `,
    actionsCell: css `
    text-align: right;
    width: 1%;
    white-space: nowrap;

    & > * + * {
      margin-left: ${theme.spacing(0.5)};
    }
  `,
});
//# sourceMappingURL=table.js.map