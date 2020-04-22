import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory, styleMixins } from '../../themes';

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
    const { palette, colors } = theme;
    const headerBg = theme.colors.bg2;
    const borderColor = theme.colors.border1;
    const resizerColor = theme.isLight ? palette.blue95 : palette.blue77;
    const padding = 6;
    const lineHeight = theme.typography.lineHeight.md;
    const bodyFontSize = 14;
    const cellHeight = padding * 2 + bodyFontSize * lineHeight;
    const rowHoverBg = styleMixins.hoverColor(theme.colors.bg1, theme);

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
        height: ${cellHeight}px;
        overflow-y: auto;
        overflow-x: hidden;
        background: ${headerBg};
        position: relative;
      `,
      headerCell: css`
        padding: ${padding}px 10px;
        cursor: pointer;
        overflow: hidden;
        white-space: nowrap;
        color: ${colors.textBlue};
        border-right: 1px solid ${theme.colors.panelBg};

        &:last-child {
          border-right: none;
        }
      `,
      row: css`
        label: row;
        border-bottom: 1px solid ${borderColor};

        &:hover {
          background-color: ${rowHoverBg};
        }
      `,
      tableCellWrapper: css`
        border-right: 1px solid ${borderColor};

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
        background: ${resizerColor};
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
        width: 8px;
        height: 100%;
        position: absolute;
        right: -4px;
        border-radius: 3px;
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
