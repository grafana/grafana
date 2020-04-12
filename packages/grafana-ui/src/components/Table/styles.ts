import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes';

export interface TableStyles {
  cellHeight: number;
  cellHeightInner: number;
  cellPadding: number;
  rowHeight: number;
  table: string;
  thead: string;
  headerCell: string;
  tableCell: string;
  tableCellWrapper: string;
  row: string;
  theme: GrafanaTheme;
  resizeHandle: string;
}

export const getTableStyles = stylesFactory(
  (theme: GrafanaTheme): TableStyles => {
    const colors = theme.palette;
    const headerBg = colors.panelBorder;
    const headerBorderColor = theme.isLight ? colors.gray70 : colors.gray05;
    const resizerColor = theme.isLight ? colors.blue77 : colors.blue95;
    const padding = 6;
    const lineHeight = theme.typography.lineHeight.md;
    const bodyFontSize = 14;
    const cellHeight = padding * 2 + bodyFontSize * lineHeight;

    return {
      theme,
      cellHeight,
      cellPadding: padding,
      cellHeightInner: bodyFontSize * lineHeight,
      rowHeight: cellHeight + 2,
      table: css`
        height: 100%;
        width: 100%;
        overflow: auto;
        display: flex;
      `,
      thead: css`
        label: thead;
        overflow-y: auto;
        overflow-x: hidden;
        background: ${headerBg};
        position: relative;
      `,
      headerCell: css`
        padding: ${padding}px 10px;
        cursor: pointer;
        white-space: nowrap;
        color: ${colors.blue};
        border-right: 1px solid ${headerBorderColor};

        &:last-child {
          border-right: none;
        }
      `,
      row: css`
        label: row;
        border-bottom: 1px solid ${headerBg};
      `,
      tableCellWrapper: css`
        border-right: 1px solid ${headerBg};

        &:last-child {
          border-right: none;
        }
      `,
      tableCell: css`
        padding: ${padding}px 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      `,
      resizeHandle: css`
        label: resizeHandle;
        cursor: col-resize !important;
        display: inline-block;
        border-right: 2px solid ${resizerColor};
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        width: 10px;
        height: 100%;
        position: absolute;
        right: 0;
        top: 0;
        z-index: ${theme.zIndex.dropdown};
        touch-action: none;

        &:hover {
          opacity: 1;
        }
      `,
    };
  }
);
