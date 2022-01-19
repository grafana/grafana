import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

/**
 * NOTE: These styles may be used to create a theme for PMM
 */
export const getStyles = ({ palette, colors, isLight }: GrafanaTheme) => {
  const backgroundColor = isLight ? 'rgb(247, 247, 249)' : 'rgb(22, 23, 25)';
  const borderColor = isLight ? palette.gray85 : palette.dark7;
  const cellPadding = '12px 8px';

  return {
    wrapper: css`
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
    empty: css`
      display: flex;
      width: 100%;
      height: 160px;
      justify-content: center;
      align-items: center;
      border: 1px solid ${borderColor};
    `,
    silenced: css`
      width: 100%;
      text-align: center;
    `,
    link: css`
      color: ${colors.linkExternal};
      &:hover {
        color: ${colors.textBlue};
      }
    `,
  };
};
