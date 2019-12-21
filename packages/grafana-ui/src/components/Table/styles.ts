import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, selectThemeVariant as stv } from '../../themes';

export const getTableStyles = stylesFactory((theme: GrafanaTheme) => {
  const colors = theme.colors;
  const headerBg = stv({ light: colors.gray6, dark: colors.dark7 }, theme.type);
  const padding = 5;

  return {
    cellHeight: padding * 2 + 14 * 1.5 + 2,
    table: css`
      overflow: auto;
      border-spacing: 0;
    `,
    thead: css`
      overflow-y: auto;
      overflow-x: hidden;
    `,
    headerCell: css`
      padding: ${padding}px 10px;
      background: ${headerBg};

      cursor: pointer;
      white-space: nowrap;

      color: ${colors.blue};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
    tableCell: css`
      display: 'table-cell';
      padding: ${padding}px 10px;

      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;

      border-right: 2px solid ${colors.bodyBg};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
  };
});
