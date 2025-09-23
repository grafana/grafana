import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  Table: css`
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
