import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant, stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const backgroundColor = selectThemeVariant({ light: 'rgb(247, 247, 249)', dark: '#161719' }, theme.type);
  const borderColor = selectThemeVariant({ light: theme.palette.gray85, dark: '#292929' }, theme.type);
  const headerBackground = selectThemeVariant({ light: 'rgb(247, 247, 249)', dark: '#3D3D3D' }, theme.type);

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
});
