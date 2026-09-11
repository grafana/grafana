import { css } from '@emotion/css';
import { type Property } from 'csstype';
import memoize, { type Key, type RawKey } from 'micro-memoize';

import { type GrafanaTheme2, colorManipulator } from '@grafana/data';

import {
  COLUMN,
  FIRST_COLUMN_CLASS,
  FIRST_COLUMN_EXTRA_PADDING,
  LAST_COLUMN_CLASS,
  NESTED_ROW_CLASS,
  PAGINATION_MARGIN,
  STRIPED_ROW_CLASS,
  TABLE,
  getPaginationChromeHeight,
} from './constants';
import { type TableCellStyles } from './types';

// TextAlign, getJustifyContent, and IS_SAFARI_26 live here rather than in utils.tsx to avoid a
// circular dependency: styles.ts → utils.tsx → renderers.tsx → AutoCell/PillCell → styles.ts
export type TextAlign = 'left' | 'right' | 'center';

export function getJustifyContent(textAlign: TextAlign): Property.JustifyContent {
  return textAlign === 'center' ? 'center' : textAlign === 'right' ? 'flex-end' : 'flex-start';
}

// Safari 26.0 introduced rendering bugs which require us to disable several features of the table.
// The bugs were later fixed in Safari 26.2.
export const IS_SAFARI_26 = (() => {
  if (navigator == null) {
    return false;
  }
  const userAgent = navigator.userAgent;
  const safariVersionMatch = userAgent.match(/Version\/(\d+)\.(\d+)/);
  if (!safariVersionMatch) {
    return false;
  }
  const majorVersion = +safariVersionMatch[1];
  const minorVersion = +safariVersionMatch[2];
  return majorVersion === 26 && minorVersion <= 1;
})();

/**
 * @internal
 * a method that can be used with micro-memoize as a cache key equality comparator.
 */
export const isTableCellStylesKeyEqual = (cacheKey: Key, key: RawKey): boolean =>
  cacheKey[0] === key[0] &&
  cacheKey[1].shouldOverflow === key[1].shouldOverflow &&
  cacheKey[1].maxHeight === key[1].maxHeight &&
  cacheKey[1].textAlign === key[1].textAlign &&
  cacheKey[1].textWrap === key[1].textWrap;

// How far the `table.refresh` header background steps away from the background the rows sit on.
// `emphasize` moves in whichever direction contrasts — lighter in dark themes, darker in light ones
// — so one coefficient covers both, as well as a transparent panel sitting on the canvas.
// `background.elevated` can't do this job: in light themes it *is* `background.primary` (both are
// white), so the header was indistinguishable from its rows.
//
// 0.06 lands the refreshed themes on the surfaces design picked for the header — ink700 in dark
// (#1f2227 against #202429) and neutral150 in light (#f0f0f0 against #f0f0ef), both within 2/255 —
// without reaching for the raw palette, which would paint the same blue-grey header onto every
// custom theme in `themeDefinitions/` regardless of its hue.
const HEADER_BACKGROUND_EMPHASIS = 0.06;

// How far a zebra stripe steps away from the background the unstriped rows sit on. Deliberately
// half the header's step: the stripe is a reading aid, not a surface, and keeping it inside the
// header's step leaves a hovered striped row somewhere to go. 0.04 lands the refreshed themes on
// ink750 in dark and neutral100 in light, the pair design picked, within 1/255 of each.
const ZEBRA_STRIPE_EMPHASIS = 0.04;

export const getGridStyles = memoize(
  (
    theme: GrafanaTheme2,
    enablePagination?: boolean,
    transparent?: boolean,
    tableRefreshEnabled?: boolean,
    noPanelPadding?: boolean,
    zebraStriping?: boolean
  ) => {
    const visualRefreshEnabled = theme.flags.visualDesignRefresh;
    let bgColor = transparent ? theme.colors.background.canvas : theme.colors.background.primary;
    if (visualRefreshEnabled) {
      bgColor = transparent ? theme.colors.background.page : theme.components.panel.background;
    }
    // `border.weak` is faint by design, and in a dark theme it loses the little contrast it had
    // once `table.refresh` steps the header this far off the row background — the grid lines read
    // as missing beside it. `border.medium` puts them back. Light themes keep `weak`: there the
    // step darkens rather than lightens, so the lines never went soft.
    const borderToken = tableRefreshEnabled && theme.isDark ? theme.colors.border.medium : theme.colors.border.weak;
    // this needs to be pre-calc'd since the theme colors have alpha and the border color becomes
    // unpredictable for background color cells
    const borderColor = colorManipulator.onBackground(borderToken, bgColor).toHexString();
    const selectedRowColor = theme.isDark
      ? colorManipulator.onBackground(theme.colors.warning.main, bgColor).darken(37).toHexString()
      : colorManipulator.onBackground(theme.colors.warning.main, bgColor).lighten(25).toHexString();

    // Same reason as `rowHoverBackgroundColor` below: with striping on, the overlay is the only
    // thing hover moves, on a selected row as much as on any other.
    const selectedRowHoverColor = zebraStriping
      ? 'var(--rdg-row-selected-background-color)'
      : theme.colors.emphasize(selectedRowColor, 0.05);

    const headerBackgroundColor = tableRefreshEnabled
      ? theme.colors.emphasize(bgColor, HEADER_BACKGROUND_EMPHASIS)
      : bgColor;

    const zebraStripeBackgroundColor = theme.colors.emphasize(bgColor, ZEBRA_STRIPE_EMPHASIS);

    // Striping draws hover as an overlay over whatever background the row already has (see the
    // rule below), so react-data-grid's own swap has to stop moving the colour — a plain row would
    // otherwise lift twice, and a striped one would lose its stripe on the way.
    const rowHoverBackgroundColor = zebraStriping
      ? 'var(--rdg-row-background-color)'
      : tableRefreshEnabled
        ? headerBackgroundColor
        : transparent
          ? theme.colors.background.primary
          : theme.colors.background.secondary;

    // The expander column is the outer table's first column (see markEdgeColumns), so under
    // `noPanelPadding` it picks up the same `FIRST_COLUMN_EXTRA_PADDING` inline-start bump as any
    // other first column — `gridNested` below has to know about it to stay flush with that column.
    const nestedGridExpanderPaddingOffset = noPanelPadding ? FIRST_COLUMN_EXTRA_PADDING : 0;

    return {
      grid: css({
        '--rdg-background-color': bgColor,
        // `table.refresh` gives the header its own surface distinct from the body rows.
        '--rdg-header-background-color': headerBackgroundColor,
        '--rdg-border-color': borderColor,
        '--rdg-color': theme.colors.text.primary,
        '--rdg-summary-border-color': borderColor,
        '--rdg-summary-border-width': '1px',

        '--rdg-selection-color': theme.colors.info.transparent,

        // note: this cannot have any transparency since default cells that
        // overlay/overflow on hover inherit this background and need to occlude cells below
        '--rdg-row-background-color': bgColor,
        // Under `table.refresh` a hovered row takes the header's surface, so "one step off the row
        // background" means one thing across the table. The old pair had the same blind spot the
        // header did: on a transparent panel it hovered *lighter* (`background.primary`), which in a
        // light theme is white on near-white.
        '--rdg-row-hover-background-color': rowHoverBackgroundColor,
        '--rdg-row-selected-background-color': selectedRowColor,
        '--rdg-row-selected-hover-background-color': selectedRowHoverColor,

        // give the pagination controls their room back, so the grid and the pager together still fit
        // the panel (see getPaginationChromeHeight)
        blockSize: enablePagination ? `calc(100% - ${getPaginationChromeHeight(noPanelPadding)}px)` : '100%',
        scrollbarWidth: 'thin',
        scrollbarColor: theme.isDark ? '#fff5 #fff1' : '#0005 #0001',

        border: 'none',

        '.rdg-cell': {
          padding: TABLE.CELL_PADDING,

          '&:last-child': {
            borderInlineEnd: 'none',
          },
          [`${SELECTED_CELL_SELECTOR}[role="columnheader"]`]: {
            outline: 'none',
          },
        },

        // add a box shadow on hover and selection for all body cells
        '& > :not(.rdg-summary-row, .rdg-header-row) > .rdg-cell': {
          [getActiveCellSelector()]: { boxShadow: theme.shadows.z2 },
          // A selected cell sits below a hovered one, so that hovering a neighbor of the selected
          // cell lifts its overflow clear rather than tucking it behind. The two selectors carry the
          // same specificity, so the hover rule has to come last for a cell that is both to land on
          // the hover value.
          [SELECTED_CELL_SELECTOR]: { zIndex: theme.zIndex.tooltip - 7 },
          ...(!IS_SAFARI_26 && { '&:hover': { zIndex: theme.zIndex.tooltip - 6 } }),
          // react-data-grid rings the selected cell in the selection color. Once focus is gone that
          // ring marks a cell the user can no longer see they are on, so leave the cell bare.
          [`${SELECTED_CELL_SELECTOR}:not(:focus-within)`]: { outline: 'none' },
        },

        '.rdg-cell.rdg-cell-frozen': {
          backgroundColor: 'var(--rdg-row-background-color)',
          zIndex: theme.zIndex.tooltip - 4,
          [SELECTED_CELL_SELECTOR]: { zIndex: theme.zIndex.tooltip - 3 },
          ...(!IS_SAFARI_26 && { '&:hover': { zIndex: theme.zIndex.tooltip - 2 } }),
        },

        // have to override styles for row selection to workaround safari styles workaround
        '[role="row"][aria-selected="true"]': {
          '&:hover': {
            '.rdg-cell.rdg-cell-frozen': {
              backgroundColor: 'var(--rdg-row-selected-hover-background-color)',
            },
          },
          '.rdg-cell.rdg-cell-frozen': {
            backgroundColor: 'var(--rdg-row-selected-background-color)',
          },
        },

        // Which rows carry a stripe is decided in `makeStripedRowClass`, not by react-data-grid's
        // own `rdg-row-odd` — see that function for why. Selection still wins over the stripe, and
        // has to be excluded by hand rather than left to win on specificity: react-data-grid paints
        // it inside its own `@layer rdg.Row`, and an unlayered rule — which everything in here is —
        // beats a layered one whatever its specificity.
        ...(zebraStriping && {
          [`.${STRIPED_ROW_CLASS}:not([aria-selected='true'])`]: {
            backgroundColor: zebraStripeBackgroundColor,
            // A `.rdg-cell` inherits its background from the row, which is how the row rule reaches
            // the cells at all (rows are `display: contents`, so they paint no box of their own).
            // Frozen cells are the exception: they set an opaque background so they can occlude the
            // cells scrolling behind them, so the stripe has to be repeated here or a striped row's
            // frozen column falls back to the plain row background.
            '.rdg-cell.rdg-cell-frozen': {
              backgroundColor: zebraStripeBackgroundColor,
            },
          },

          // Hover is a lift *over* the row's own background rather than a different background:
          // with two row backgrounds in play, no single hover colour can sit the same distance from
          // both, and replacing it made hover a weaker signal on exactly the striped rows. An
          // `action.hover` overlay is the same relative step on plain, striped and selected rows
          // alike, and it leaves the stripe visible underneath instead of erasing it.
          //
          // It goes on the cells, not the row: a row paints no box of its own, and frozen cells
          // carry their own opaque background that a row-level rule would never reach. Cells whose
          // own colour comes from a cell display mode set it inline, so they keep ignoring hover
          // exactly as they do today. Nested containers are skipped because hovering a row of an
          // inner table also hovers the container that table sits in, which would tint the whole
          // sub-table.
          [`.rdg-row:not(.rdg-summary-row, .${NESTED_ROW_CLASS}):hover > .rdg-cell`]: {
            backgroundImage: `linear-gradient(${theme.colors.action.hover}, ${theme.colors.action.hover})`,
          },
        }),

        '.rdg-header-row, .rdg-summary-row': {
          '.rdg-cell': {
            zIndex: theme.zIndex.tooltip - 5,
            '&.rdg-cell-frozen': {
              zIndex: theme.zIndex.tooltip - 1,
            },
          },
        },
        '.rdg-summary-row >': {
          '.rdg-cell': {
            // 0.75 padding causes "jumping" on hover.
            paddingBlock: theme.spacing(0.625),
          },
          [getActiveCellSelector()]: {
            whiteSpace: 'pre-line',
            height: '100%',
            minHeight: 'fit-content',
            overflowY: 'visible',
            boxShadow: theme.shadows.z2,
          },
        },

        // `table.refresh` rounds the table's top corners, matching the header's own surface.
        ...(tableRefreshEnabled && {
          // The header cells' own rounded corners (below) leave the area outside the radius
          // transparent, so a row scrolling under the sticky header painted straight through it.
          // This grid is the scroll container, so rounding it clips everything it scrolls — the rows
          // included — and the panel shows through the corner instead of a row's background.
          borderStartStartRadius: theme.shape.radius.default,
          borderStartEndRadius: theme.shape.radius.default,
          '.rdg-header-row > .rdg-cell': {
            // Sub-pixel scroll offsets can leave a hairline gap above the sticky header where the
            // row scrolled underneath it shows through — invisible before this commit, since the
            // header shared the row background, but visible now that it's its own surface. A
            // same-color 1px shadow just above the header's own box masks it without needing to
            // touch react-data-grid's own sticky positioning. `overflow: hidden` below (for the
            // rounded corners) doesn't clip this: it governs the cell's own content, not a
            // box-shadow painted at its border edge.
            boxShadow: '0 -1px 0 0 var(--rdg-header-background-color)',
          },
          // The `.rdg-cell.rdg-cell-frozen` rule above (for solid, occluding frozen body cells)
          // also matches frozen *header* cells, at higher specificity than the plain `.rdg-cell`
          // inheriting the header's background — so a frozen column's header cell fell back to the
          // row background instead. Three classes' worth of specificity here beats that rule's two.
          '.rdg-header-row > .rdg-cell.rdg-cell-frozen': {
            backgroundColor: 'var(--rdg-header-background-color)',
          },
          [`.rdg-header-row > .rdg-cell.${FIRST_COLUMN_CLASS}`]: {
            borderStartStartRadius: theme.shape.radius.default,
            overflow: 'hidden',
          },
          [`.rdg-header-row > .rdg-cell.${LAST_COLUMN_CLASS}`]: {
            borderStartEndRadius: theme.shape.radius.default,
            overflow: 'hidden',
          },
          // The footer is the last row in the grid, so react-data-grid's per-cell bottom border
          // draws a hairline along the table's own bottom edge with nothing below it to divide.
          // Its top border (`--rdg-summary-border-*`) still separates it from the rows above.
          '.rdg-bottom-summary-row > .rdg-cell': {
            borderBlockEnd: 'none',
          },
        }),
      }),
      // The panel around the table drops its own padding so the header surface can bleed to the
      // panel edges, which leaves the first column's content further left than the panel title.
      // A class of its own rather than part of `grid`: a nested table's inner grid also carries
      // `grid`, and only the outermost table's first column lines up with the panel title.
      firstColumnInset: css({
        [`& > * > .rdg-cell.${FIRST_COLUMN_CLASS}`]: {
          paddingInlineStart: TABLE.CELL_PADDING + FIRST_COLUMN_EXTRA_PADDING,
        },
      }),
      gridNested: css({
        // react-data-grid's root sets `content-visibility: auto`. The nested grid's wrapper has no
        // definite height, so its skipped-contents size is 0, and in Firefox a zero-size element never
        // intersects the viewport, never becomes relevant, and stays collapsed forever.
        contentVisibility: 'visible',
        height: '100%',
        // The expander column is tagged `FIRST_COLUMN_CLASS` (see markEdgeColumns), so under
        // `noPanelPadding` its own paddingInlineStart grows by `FIRST_COLUMN_EXTRA_PADDING` too —
        // subtract it back out here so this nested grid still starts flush with the expander
        // column's edge instead of drifting right by that same amount.
        width: `calc(100% - ${COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING * 2 - nestedGridExpanderPaddingOffset - 1}px)`,
        overflowX: 'scroll',
        overflowY: 'hidden',
        marginLeft: COLUMN.EXPANDER_WIDTH - TABLE.CELL_PADDING - nestedGridExpanderPaddingOffset - 1,
        marginBlock: TABLE.CELL_PADDING,
        // usually row height will be set to 0 when not expanded, but auto cell height may lead to some rendering errors.
        '&[aria-expanded="false"]': {
          display: 'none',
        },
      }),
      cellNested: css({
        [SELECTED_CELL_SELECTOR]: { outline: 'none' },
        '&:hover': { backgroundColor: 'transparent' },
      }),
      noDataNested: css({
        height: TABLE.NESTED_NO_DATA_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.colors.text.secondary,
        fontSize: theme.typography.h4.fontSize,
      }),
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
        // equal to theme.spacing(1), but taken from the same constant the grid reserves against so the
        // two can't drift apart. Only `noPanelPadding` gets a bottom margin: with the panel's own
        // padding in place, the controls already have that space below them.
        marginBlockStart: PAGINATION_MARGIN,
        marginBlockEnd: noPanelPadding ? PAGINATION_MARGIN : 0,
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
    };
  }
);

export const getHeaderCellStyles = memoize((theme: GrafanaTheme2, justifyContent: Property.JustifyContent) =>
  css({
    display: 'flex',
    gap: theme.spacing(0.5),
    zIndex: theme.zIndex.tooltip - 1,
    paddingInline: TABLE.CELL_PADDING,
    paddingBlockEnd: TABLE.CELL_PADDING,
    justifyContent,
    '&:last-child': { borderInlineEnd: 'none' },
  })
);

export const getDefaultCellStyles: TableCellStyles = memoize(
  (theme, { textAlign, shouldOverflow, maxHeight }) =>
    css({
      display: 'flex',
      alignItems: 'center',
      textAlign,
      justifyContent: Boolean(maxHeight) ? 'flex-start' : getJustifyContent(textAlign),
      ...(maxHeight && { overflowY: 'hidden' }),
      ...(shouldOverflow && { minHeight: '100%' }),

      [getActiveCellSelector()]: {
        ...(shouldOverflow && {
          zIndex: theme.zIndex.tooltip - 2,
          height: 'fit-content',
          minWidth: 'fit-content',
        }),
      },

      [getHoverOnlyCellSelector()]: {
        '.table-cell-actions': { display: 'flex' },
      },
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);

export const getMaxHeightCellStyles: TableCellStyles = memoize(
  (_theme, { textAlign, maxHeight }) =>
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
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);

export const getCellActionStyles = memoize((theme: GrafanaTheme2, textAlign: TextAlign) =>
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
  })
);

export const getLinkStyles = memoize((theme: GrafanaTheme2, canBeColorized: boolean) =>
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
  })
);

const caretTriangle = (direction: 'left' | 'right', bgColor: string) =>
  `linear-gradient(to top ${direction}, transparent 62.5%, ${bgColor} 50%)`;

export const getTooltipStyles = memoize((theme: GrafanaTheme2, textAlign: TextAlign) => ({
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
    boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
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
}));

/**
 * A cell react-data-grid considers selected, whether or not the grid still has focus. Use this for
 * resets and stacking that have to hold for as long as the selection does — see ACTIVE_CELL_SELECTORS
 * for the visual treatment that follows focus instead.
 */
const SELECTED_CELL_SELECTOR = '&[aria-selected=true]';

const ACTIVE_CELL_SELECTORS = {
  hover: {
    nested: '.rdg-cell:hover &',
    normal: '&:hover',
  },
  // react-data-grid keeps a cell selected after the grid loses focus, and offers no API to clear it
  // (`selectCell` rejects any out-of-bounds position), so gate on `:focus-within` to release the
  // expanded state when the user clicks away from the table.
  selected: {
    nested: '[aria-selected=true]:focus-within &',
    normal: `${SELECTED_CELL_SELECTOR}:focus-within`,
  },
} as const;

export const getActiveCellSelector = memoize((isNested?: boolean) => {
  const selectors = [];
  selectors.push(ACTIVE_CELL_SELECTORS.selected[isNested ? 'nested' : 'normal']);
  if (!IS_SAFARI_26) {
    selectors.push(ACTIVE_CELL_SELECTORS.hover[isNested ? 'nested' : 'normal']);
  }
  return selectors.join(', ');
});

const getHoverOnlyCellSelector = memoize((isNested?: boolean) => {
  if (IS_SAFARI_26) {
    return '';
  }
  return ACTIVE_CELL_SELECTORS.hover[isNested ? 'nested' : 'normal'];
});
