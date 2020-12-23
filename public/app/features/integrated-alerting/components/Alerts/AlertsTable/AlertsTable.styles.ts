import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getStyles = (theme: GrafanaTheme) => {
  const { colors } = theme;

  const borderColor = colors.border2;
  const backgroundColorBody = colors.bg1;
  const backgroundColorHeader = colors.bg2;

  const cellPadding = 16;

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
          padding: 0 ${cellPadding}px;
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
    `,
    empty: css`
      display: flex;
      width: 100%;
      height: 160px;
      justify-content: center;
      align-items: center;
      border: 1px solid ${backgroundColorBody};
    `,
    labelsWrapper: css`
      padding: 5px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      margin: 0 -${cellPadding}px;
    `,
    label: css`
      background-color: ${colors.bg3};
      border-radius: 8px;
      padding: 6px;
      line-height: 1;
      margin: 5px;
    `,
    disabledRow: css`
      & td {
        color: ${colors.textWeak};
        background-color: ${colors.dashboardBg} !important;
      }
    `,
  };
};
