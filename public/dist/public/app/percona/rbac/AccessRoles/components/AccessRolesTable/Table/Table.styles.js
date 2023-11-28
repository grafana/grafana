import { css } from '@emotion/css';
export const getStyles = (theme) => ({
    Table: css `
    table {
      tr {
        th,
        td {
          padding: ${theme.spacing(1.25)};
        }

        th {
          color: ${theme.colors.text.secondary};
          border: none;
          font-weight: 400;
        }

        td {
          border-right: none;
        }
      }
    }
  `,
});
//# sourceMappingURL=Table.styles.js.map