import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { COLUMN, TABLE } from './constants';
import { TableCellStyles } from './types';
import { getJustifyContent, TextAlign } from './utils';

export const getGridStyles = (theme: GrafanaTheme2) => ({
  gridNested: css({
    height: '100%',
    width: `calc(100% - ${COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING * 2 - 1}px)`,
    overflowX: 'scroll',
    overflowY: 'hidden',
    marginLeft: COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING - 1,
    marginBlock: TABLE.CELL_PADDING,
  }),
  cellNested: css({ '&[aria-selected=true]': { outline: 'none' } }),
  noDataNested: css({
    height: TABLE.NESTED_NO_DATA_HEIGHT,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.h4.fontSize,
  }),
  displayNone: css({ display: 'none' }),
  menuItem: css({ maxWidth: '200px' }),
});

export const getHeaderCellStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) =>
  css({
    display: 'flex',
    gap: theme.spacing(0.5),
    zIndex: theme.zIndex.tooltip - 1,
    paddingInline: TABLE.CELL_PADDING,
    paddingBlockEnd: TABLE.CELL_PADDING,
    justifyContent,
    '&:last-child': { borderInlineEnd: 'none' },
  });

export const getDefaultCellStyles: TableCellStyles = (theme, { textAlign, shouldOverflow, maxHeight }) =>
  css({
    display: 'flex',
    alignItems: 'center',
    textAlign,
    justifyContent: Boolean(maxHeight) ? 'flex-start' : getJustifyContent(textAlign),
    ...(maxHeight && { overflowY: 'hidden' }),
    ...(shouldOverflow && { minHeight: '100%' }),

    [getActiveCellSelector()]: {
      '.table-cell-actions': { display: 'flex' },
      ...(shouldOverflow && {
        zIndex: theme.zIndex.tooltip - 2,
        height: 'fit-content',
        minWidth: 'fit-content',
      }),
    },
  });

export const getMaxHeightCellStyles: TableCellStyles = (_theme, { textAlign, maxHeight }) =>
  css({
    display: 'flex',
    alignItems: 'center',
    textAlign,
    justifyContent: getJustifyContent(textAlign),
    maxHeight,
    width: '100%',
    overflowY: 'hidden',
    [getActiveCellSelector(true)]: {
      maxHeight: 'none',
      minHeight: '100%',
    },
  });

export const getCellActionStyles = (theme: GrafanaTheme2, textAlign: TextAlign) =>
  css({
    display: 'none',
    position: 'absolute',
    top: 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
    background: theme.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    padding: theme.spacing.x0_5,
    paddingInlineStart: theme.spacing.x1,
    [textAlign === 'right' ? 'left' : 'right']: 0,
  });

export const getLinkStyles = (theme: GrafanaTheme2, canBeColorized: boolean) =>
  css({
    a: {
      cursor: 'pointer',
      ...(canBeColorized
        ? {
            color: 'inherit',
            textDecoration: 'underline',
          }
        : {
            color: theme.colors.text.link,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
          }),
    },
  });

const caretTriangle = (direction: 'left' | 'right', bgColor: string) =>
  `linear-gradient(to top ${direction}, transparent 62.5%, ${bgColor} 50%)`;

export const getTooltipStyles = (theme: GrafanaTheme2, textAlign: TextAlign) => ({
  tooltipContent: css({
    height: '100%',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
  }),
  tooltipWrapper: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    overflow: 'hidden',
    padding: theme.spacing(1),
    width: 'inherit',
  }),
  tooltipCaret: css({
    cursor: 'pointer',
    position: 'absolute',
    top: theme.spacing(0.25),
    [textAlign === 'right' ? 'right' : 'left']: theme.spacing(0.25),
    width: theme.spacing(1.75),
    height: theme.spacing(1.75),
    background: caretTriangle(textAlign === 'right' ? 'right' : 'left', theme.colors.border.strong),
  }),
});

export const getActiveCellSelector = (isNested?: boolean) =>
  isNested ? '.rdg-cell:hover &, [aria-selected=true] &' : '&:hover, &[aria-selected=true]';
