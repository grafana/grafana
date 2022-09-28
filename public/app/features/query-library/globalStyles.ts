import { css } from '@emotion/react';

import { GrafanaTheme2 } from '@grafana/data';

export function getGlobalStyles(theme: GrafanaTheme2) {
  return css`
    .filter-table {
      border-collapse: separate;
      border-spacing: 0 5px;

      tbody {
        tr:nth-child(odd) {
          background: ${theme.colors.background.secondary};
        }

        tr {
          background: ${theme.colors.background.secondary};
        }
      }

      &--hover {
        tbody tr:hover {
          background: ${theme.colors.background.primary};
        }
      }
    }
  `;
}
