import { css } from '@emotion/css';
import { Property } from 'csstype';

import { GrafanaTheme2 } from '@grafana/data';

import { COLUMN, TABLE } from './constants';
import { TableCellStyles } from './types';
import { getJustifyContent } from './utils';

export const getGridStyles = (
  theme: GrafanaTheme2,
  { enablePagination, transparent }: { enablePagination?: boolean; transparent?: boolean }
) => ({
  grid: css({
    '--rdg-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-header-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-border-color': theme.colors.border.weak,
    '--rdg-color': theme.colors.text.primary,
    '--rdg-summary-border-color': theme.colors.border.weak,
    '--rdg-summary-border-width': '1px',

    // note: this cannot have any transparency since default cells that
    // overlay/overflow on hover inherit this background and need to occlude cells below
    '--rdg-row-background-color': transparent ? theme.colors.background.canvas : theme.colors.background.primary,
    '--rdg-row-hover-background-color': transparent
      ? theme.colors.background.primary
      : theme.colors.background.secondary,

    // TODO: magic 32px number is unfortunate. it would be better to have the content
    // flow using flexbox rather than hard-coding this size via a calc
    blockSize: enablePagination ? 'calc(100% - 32px)' : '100%',
    scrollbarWidth: 'thin',
    scrollbarColor: theme.isDark ? '#fff5 #fff1' : '#0005 #0001',

    border: 'none',

    '.rdg-cell': {
      padding: TABLE.CELL_PADDING,

      '&:last-child': {
        borderInlineEnd: 'none',
      },
    },

    // add a box shadow on hover and selection for all body cells
    '& > :not(.rdg-summary-row, .rdg-header-row) > .rdg-cell': {
      '&:hover, &[aria-selected=true]': { boxShadow: theme.shadows.z2 },
      // selected cells should appear below hovered cells.
      '&:hover': { zIndex: theme.zIndex.tooltip - 4 },
      '&[aria-selected=true]': { zIndex: theme.zIndex.tooltip - 5 },
    },

    '.rdg-cell.rdg-cell-frozen': { zIndex: theme.zIndex.tooltip - 2 },

    '.rdg-header-row, .rdg-summary-row': {
      '.rdg-cell': {
        zIndex: theme.zIndex.tooltip - 3,

        '&.rdg-cell-frozen': {
          zIndex: theme.zIndex.tooltip - 1,
        },
      },
    },
  }),
  gridNested: css({
    height: '100%',
    width: `calc(100% - ${COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING * 2 - 1}px)`,
    overflow: 'visible',
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
  cellActions: css({
    display: 'none',
    position: 'absolute',
    top: 0,
    margin: 'auto',
    height: '100%',
    color: theme.colors.text.primary,
    background: theme.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    padding: theme.spacing.x0_5,
    paddingInlineStart: theme.spacing.x1,
  }),
  cellActionsEnd: css({ left: 0 }),
  cellActionsStart: css({ right: 0 }),
  headerRow: css({
    paddingBlockStart: 0,
    fontWeight: 'normal',
    '& .rdg-cell': { height: '100%', alignItems: 'flex-end' },
  }),
  displayNone: css({ display: 'none' }),
  paginationContainer: css({
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    marginTop: '8px',
    width: '100%',
  }),
  paginationSummary: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    display: 'flex',
    justifyContent: 'flex-end',
    padding: theme.spacing(0, 1, 0, 2),
  }),
  menuItem: css({ maxWidth: '200px' }),
});

export const getFooterStyles = (justifyContent: Property.JustifyContent) => ({
  footerCellCountRows: css({ display: 'flex', justifyContent: 'space-between' }),
  footerCell: css({ display: 'flex', justifyContent: justifyContent || 'space-between' }),
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

export const getDefaultCellStyles: TableCellStyles = (theme, { textAlign, shouldOverflow }) =>
  css({
    display: 'flex',
    alignItems: 'center',
    textAlign,
    backgroundClip: 'padding-box !important', // helps when cells have a bg color
    justifyContent: getJustifyContent(textAlign),
    ...(shouldOverflow && { minHeight: '100%' }),
    '&:hover, &[aria-selected=true]': {
      '.table-cell-actions': { display: 'flex' },
      ...(shouldOverflow && {
        zIndex: theme.zIndex.tooltip - 2,
        height: 'fit-content',
        minWidth: 'fit-content',
      }),
    },
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
