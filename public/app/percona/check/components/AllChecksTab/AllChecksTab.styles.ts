import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';

export const getStyles = ({ isLight, v1: { palette, colors } }: GrafanaTheme2) => {
  const backgroundColor = isLight ? 'rgb(247, 247, 249)' : 'rgb(22, 23, 25)';
  const borderColor = isLight ? palette.gray85 : palette.dark7;
  const cellPadding = '12px 8px';

  return {
    wrapper: css`
      background-color: transparent;
      display: flex;
      flex-direction: row;
      justify-content: center;
      overflow-y: scroll;
      height: 100%;
    `,
    nameColumn: css`
      width: 250px;
    `,
    statusColumn: css`
      width: 100px;
    `,
    actionsColumn: css`
      width: 150px;
    `,
    intervalColumn: css`
      width: 150px;
    `,
    tableWrapper: css`
      background-color: ${backgroundColor};
      display: flex;
      flex-direction: column;
      margin-bottom: 1em;
      overflow: auto;
    `,
    table: css`
      border-collapse: collapse;
      border: 1px solid ${borderColor};
      border-spacing: 0;
      background-color: ${backgroundColor};
      color: ${colors.text};
      width: 100%;

      thead {
        tr {
          th {
            background-color: ${backgroundColor};
            border: 1px solid ${borderColor};
            box-shadow: 0 1px 0 ${borderColor}, 0 -1px 0 ${borderColor};
            padding: ${cellPadding};
            position: sticky;
            top: 0;
            word-wrap: break-word;
          }
        }
      }
      tbody {
        tr {
          td {
            padding: ${cellPadding};
            border: 1px solid ${borderColor};
          }
        }
      }
    `,
  };
};
