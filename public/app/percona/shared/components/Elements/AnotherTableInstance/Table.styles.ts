import { css } from '@emotion/css';

import { GrafanaTheme } from '@grafana/data';

export const getStyles = ({ isLight, palette }: GrafanaTheme) => {
  const backgroundColor = isLight ? 'rgb(247, 247, 249)' : '#161719';
  const borderColor = isLight ? palette.gray85 : 'rgb(41, 41, 41)';
  const headerBackground = isLight ? 'rgb(247, 247, 249)' : '#3D3D3D';

  return {
    /* This will make the table scrollable when it gets too small */
    tableWrap: css`
      display: block;
      max-width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      border: 1px solid ${borderColor};
    `,
    table: css`
      /* This is required to make the table full-width */
      display: block;
      max-width: 100%;

      table {
        /* Make sure the inner table is always as wide as needed */
        width: 100%;
        border-spacing: 0;
        border: 1px solid ${borderColor};

        tr {
          :last-child {
            td {
              border-bottom: 0;
            }
          }
        }
        th,
        td {
          background-color: ${backgroundColor};
          margin: 0;
          padding: 0.5rem;
          border-bottom: 1px solid ${borderColor};
          border-right: 1px solid ${borderColor};
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;

          :last-child {
            border-right: 0;
          }
        }

        th {
          background-color: ${headerBackground};
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
      border: 1px solid ${borderColor};
    `,
    checkboxColumn: css`
      width: 20px;
    `,
    checkbox: css`
      label {
        display: unset;
      }
    `,
  };
};
