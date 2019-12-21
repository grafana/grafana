import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, selectThemeVariant as stv } from '../../themes';

export interface TableStyles {
  cellHeight: number;
  cellPadding: number;
  table: string;
  thead: string;
  headerCell: string;
  tableCell: string;
  row: string;
  theme: GrafanaTheme;
}

export const getTableStyles = stylesFactory(
  (theme: GrafanaTheme): TableStyles => {
    const colors = theme.colors;
    const headerBg = stv({ light: colors.gray6, dark: colors.dark7 }, theme.type);
    const padding = 6;

    return {
      theme,
      cellPadding: padding,
      cellHeight: padding * 2 + 14 * 1.5 + 2,
      table: css`
        overflow: auto;
        border-spacing: 0;
      `,
      thead: css`
        overflow-y: auto;
        overflow-x: hidden;
        background: ${headerBg};
      `,
      headerCell: css`
        padding: ${padding}px 10px;
        cursor: pointer;
        white-space: nowrap;
        color: ${colors.blue};
      `,
      row: css``,
      tableCell: css`
        display: 'table-cell';
        padding: ${padding}px 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        border-bottom: 2px solid ${colors.bodyBg};
      `,
    };
  }
);
