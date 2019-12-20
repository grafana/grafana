import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, selectThemeVariant as stv } from '../../themes';

export const getTableStyles = stylesFactory((theme: GrafanaTheme, columnWidth: number) => {
  const colors = theme.colors;
  const headerBg = stv({ light: colors.gray6, dark: colors.dark7 }, theme.type);
  const padding = 5;

  return {
    cellHeight: padding * 2 + 14 * 1.5 + 2,
    tableHeader: css`
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
      width: ${columnWidth}px;

      border-right: 2px solid ${colors.bodyBg};
      border-bottom: 2px solid ${colors.bodyBg};
    `,
  };
});
