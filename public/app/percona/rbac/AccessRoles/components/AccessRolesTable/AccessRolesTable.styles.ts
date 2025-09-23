import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme2) => ({
  Table: css`
    thead {
      tr {
        th {
          height: 34px;
        }
      }
    }
  `,
});
