import { css, CSSObject } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getTableStyles = (theme: GrafanaTheme2) => {
  const { colors } = theme;
  const headerBg = theme.colors.background.secondary;
  const borderColor = theme.colors.border.weak;
  const resizerColor = theme.colors.primary.border;
  const cellPadding = 6;
  const lineHeight = theme.typography.body.lineHeight;
  const bodyFontSize = 14;
  const cellHeight = cellPadding * 2 + bodyFontSize * lineHeight;
  const rowHeight = cellHeight + 2;
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  const buildCellContainerStyle = (color?: string, background?: string, overflowOnHover?: boolean) => {
    const cellActionsOverflow: CSSObject = {
      margin: theme.spacing(0, -0.5, 0, 0.5),
    };
    const cellActionsNoOverflow: CSSObject = {
      position: 'absolute',
      top: 0,
      right: 0,
      margin: 'auto',
    };

    const onHoverOverflow: CSSObject = {
      overflow: 'visible',
      width: 'auto !important',
      boxShadow: `0 0 2px ${theme.colors.primary.main}`,
      background: background ?? rowHoverBg,
      zIndex: 1,
    };

    return css`
      label: ${overflowOnHover ? 'cellContainerOverflow' : 'cellContainerNoOverflow'};
      padding: ${cellPadding}px;
      width: 100%;
      // Cell height need to account for row border
      height: ${rowHeight - 1}px;
      display: flex;
      align-items: center;
      border-right: 1px solid ${borderColor};

      ${color ? `color: ${color};` : ''};
      ${background ? `background: ${background};` : ''};
      background-clip: padding-box;

      &:last-child:not(:only-child) {
        border-right: none;
      }

      &:hover {
        ${overflowOnHover && onHoverOverflow};
        .cellActions {
          visibility: visible;
          opacity: 1;
          width: auto;
        }
      }

      a {
        color: inherit;
      }

      .cellActions {
        display: flex;
        ${overflowOnHover ? cellActionsOverflow : cellActionsNoOverflow}
        visibility: hidden;
        opacity: 0;
        width: 0;
        align-items: center;
        height: 100%;
        padding: ${theme.spacing(1, 0.5, 1, 0.5)};
        background: ${background ? 'none' : theme.colors.emphasize(theme.colors.background.primary, 0.03)};

        svg {
          color: ${color};
        }
      }

      .cellActionsLeft {
        right: auto !important;
        left: 0;
      }

      .cellActionsTransparent {
        background: none;
      }
    `;
  };

  return {
    theme,
    cellHeight,
    buildCellContainerStyle,
    cellPadding,
    cellHeightInner: bodyFontSize * lineHeight,
    rowHeight,
    table: css`
      height: 100%;
      width: 100%;
      overflow: auto;
      display: flex;
      flex-direction: column;
    `,
    thead: css`
      label: thead;
      height: ${cellHeight}px;
      overflow-y: auto;
      overflow-x: hidden;
      background: ${headerBg};
      position: relative;
    `,
    tfoot: css`
      label: tfoot;
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
      color: ${colors.primary.text};
      border-right: 1px solid ${theme.colors.border.weak};
      display: flex;

      &:last-child {
        border-right: none;
      }
    `,
    headerCellLabel: css`
      border: none;
      padding: 0;
      background: inherit;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      margin-right: ${theme.spacing(0.5)};
    `,
    cellContainer: buildCellContainerStyle(undefined, undefined, true),
    cellContainerNoOverflow: buildCellContainerStyle(undefined, undefined, false),
    cellText: css`
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
      white-space: nowrap;
    `,
    cellLink: css`
      cursor: pointer;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
      white-space: nowrap;
      text-decoration: underline;
    `,
    imageCellLink: css`
      cursor: pointer;
      overflow: hidden;
      height: 100%;
    `,
    headerFilter: css`
      background: transparent;
      border: none;
      label: headerFilter;
      padding: 0;
    `,
    paginationWrapper: css`
      display: flex;
      background: ${headerBg};
      height: ${cellHeight}px;
      justify-content: center;
      align-items: center;
      width: 100%;
      border-top: 1px solid ${theme.colors.border.weak};
      li {
        margin-bottom: 0;
      }
    `,
    paginationItem: css`
      flex: 20%;
    `,
    paginationCenterItem: css`
      flex: 100%;
      display: flex;
      justify-content: center;
    `,
    paginationSummary: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      display: flex;
      justify-content: flex-end;
      flex: 20%;
      padding-right: ${theme.spacing(1)};
    `,

    tableContentWrapper: (totalColumnsWidth: number) => {
      const width = totalColumnsWidth !== undefined ? `${totalColumnsWidth}px` : '100%';

      return css`
        label: tableContentWrapper;
        width: ${width};
        display: flex;
        flex-direction: column;
      `;
    },
    row: css`
      label: row;
      border-bottom: 1px solid ${borderColor};

      &:hover {
        background-color: ${rowHoverBg};
      }

      &:last-child {
        border-bottom: 0;
      }
    `,
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
      touch-action: none;

      &:hover {
        opacity: 1;
      }
    `,
    typeIcon: css`
      margin-right: ${theme.spacing(1)};
      color: ${theme.colors.text.secondary};
    `,
    noData: css`
      align-items: center;
      display: flex;
      height: 100%;
      justify-content: center;
      width: 100%;
    `,
    expanderCell: css`
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: ${rowHeight}px;
      cursor: pointer;
    `,
  };
};

export type TableStyles = ReturnType<typeof getTableStyles>;
