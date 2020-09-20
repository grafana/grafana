import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, stylesFactory } from '../../themes';
import { getScrollbarWidth } from '../../utils';
import { ContentPosition } from 'csstype';

export interface GetCellStyleOptions {
  color?: string;
  background?: string;
  justify?: ContentPosition;
}

export const getTableStyles = stylesFactory((theme: GrafanaTheme) => {
  const { palette, colors } = theme;
  const headerBg = theme.colors.bg2;
  const borderColor = theme.colors.border1;
  const resizerColor = theme.isLight ? palette.blue95 : palette.blue77;
  const cellPadding = 6;
  const lineHeight = theme.typography.lineHeight.md;
  const bodyFontSize = 14;
  const cellHeight = cellPadding * 2 + bodyFontSize * lineHeight;
  const rowHoverBg = styleMixins.hoverColor(theme.colors.bg1, theme);
  const scollbarWidth = getScrollbarWidth();

  const getCellStyle = (cellOptions: GetCellStyleOptions = {}) => {
    return css`
      padding: ${cellPadding}px;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: ${cellOptions.justify};
      border-right: 1px solid ${borderColor};

      ${cellOptions.color ? `color: ${cellOptions.color};` : ''};
      ${cellOptions.background ? `background: ${cellOptions.background};` : ''};

      &:last-child {
        border-right: none;

        > div {
          padding-right: ${scollbarWidth + cellPadding}px;
        }
      }

      &:hover {
        overflow: visible;
        width: auto !important;
        box-shadow: 0 0 2px ${theme.colors.formFocusOutline};
        background: ${cellOptions.background ?? rowHoverBg};
        z-index: 1;
      }
    `;
  };

  return {
    theme,
    cellHeight,
    getCellStyle,
    cellPadding,
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
      padding: ${cellPadding}px;
      overflow: hidden;
      white-space: nowrap;
      color: ${colors.textBlue};
      border-right: 1px solid ${theme.colors.panelBg};
      display: flex;

      &:last-child {
        border-right: none;
      }
    `,
    headerCellLabel: css`
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      margin-right: ${theme.spacing.xs};
    `,
    cellText: css`
      cursor: text;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
      white-space: nowrap;
    `,
    headerFilter: css`
      label: headerFilter;
      cursor: pointer;
    `,
    row: css`
      label: row;
      border-bottom: 1px solid ${borderColor};

      &:hover {
        background-color: ${rowHoverBg};
      }
    `,
    tableCellLink: css`
      cursor: text;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
      white-space: nowrap;
      text-decoration: underline;
    `,
    //tableCell: getCellStyle(),
    imageCell: css`
      height: 100%;
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
});

export type TableStyles = ReturnType<typeof getTableStyles>;
