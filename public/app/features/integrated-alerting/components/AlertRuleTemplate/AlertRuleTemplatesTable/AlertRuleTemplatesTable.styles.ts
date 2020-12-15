import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const { colors } = theme;

  const borderColor = colors.border2;
  const backgroundColorBody = colors.bg1;
  const backgroundColorHeader = colors.bg2;

  return {
    /* This will make the table scrollable when it gets too small */
    tableWrap: css`
      border: 1px solid ${borderColor};
      display: block;
      max-width: 100%;
      max-height: 500px;
      overflow: auto;
    `,
    table: css`
      /* This is required to make the table full-width */
      display: block;
      max-width: 100%;

      table {
        /* Make sure the inner table is always as wide as needed */
        width: 100%;
        border-spacing: 0;

        thead {
          tr {
            height: 48px;

            th {
              position: sticky;
              top: 0;
              z-index: 1;
            }
          }
        }

        tbody {
          tr {
            height: 70px;
          }
        }

        tr {
          :last-child {
            td {
              border-bottom: 0;
            }
          }
        }
        th,
        td {
          background-color: ${backgroundColorBody};
          margin: 0;
          padding: 0 16px;
          border-bottom: 1px solid ${borderColor};
          border-right: 1px solid ${borderColor};

          :last-child {
            border-right: 0;
          }
        }

        th {
          background-color: ${backgroundColorHeader};
        }
      }

      .pagination {
        padding: 0.5rem;
      }
    `,
    empty: css`
      display: flex;
      width: 100%;
      height: 160px;
      justify-content: center;
      align-items: center;
      border: 1px solid ${backgroundColorBody};
    `,
  };
});
