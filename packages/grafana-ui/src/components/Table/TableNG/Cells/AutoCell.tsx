import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';

import { formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { TABLE } from '../constants';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type AutoCellProps, type TableCellStyleOptions, type TableCellStyles } from '../types';

export function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {formattedValue}
    </MaybeWrapWithLink>
  );
}

/**
 * `pre-line` collapses runs of whitespace, which suits prose but flattens the indentation a JSON
 * cell depends on; `pre-wrap` keeps it and still soft-wraps lines too long for the column.
 */
type CellWhiteSpace = 'pre-line' | 'pre-wrap';

/**
 * Shared style body for every cell rendered by AutoCell. The whitespace mode is a parameter rather
 * than something a caller layers on afterwards: two classes each declaring `white-space` have equal
 * specificity, so the winner would come down to the order emotion happened to insert them.
 */
function buildAutoCellStyles(
  { textWrap, shouldOverflow, maxHeight }: TableCellStyleOptions,
  whiteSpace: CellWhiteSpace,
  // Bounds the hover expansion. Worth it where a single value can be arbitrarily large, since an
  // unbounded cell grows past the panel and puts its own content out of reach. Applies in both the
  // no-maxHeight and maxHeight branches below — a row-height clamp still clears itself on hover
  // (WebkitLineClamp: 'none', height: 'fit-content'), so without a cap here too a JSON cell in a
  // fixed-height row would grow unbounded on hover, the exact overflow this option exists to stop.
  boundExpansion = false
) {
  // never shrink below the column's own width — only grow past it, up to the cap. Without this, a
  // cell in a column wider than the cap would visually shrink to the cap on hover: the cursor ends up
  // past the now-narrower box, hover ends, the box snaps back under the cursor, hover re-fires, and
  // it flickers between the two sizes.
  //
  // the cell root inherits `align-items: center` from the default cell styles. Centering an
  // overflow-clipped box is "unsafe" by default: content taller than the cap gets centered on the
  // box's midpoint, pushing the top of the content into the negative-scroll region above scrollTop 0
  // — unreachable, since scrolling up further isn't possible past 0. That reads as the cell opening
  // already scrolled a few lines down with no way back to the top.
  const expansionBounds = {
    minWidth: '100%',
    maxWidth: TABLE.JSON_OVERFLOW_MAX_WIDTH,
    maxHeight: TABLE.JSON_OVERFLOW_MAX_HEIGHT,
    overflowY: 'auto' as const,
    alignItems: 'flex-start' as const,
  };

  return css({
    ...(textWrap && { whiteSpace }),
    ...(shouldOverflow && {
      [getActiveCellSelector(Boolean(maxHeight))]: {
        whiteSpace,
        ...(boundExpansion && maxHeight == null && expansionBounds),
      },
    }),
    ...(maxHeight != null &&
      textWrap && {
        height: 'auto',
        overflowY: 'hidden',
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: Math.floor(maxHeight / TABLE.LINE_HEIGHT),
        [getActiveCellSelector(true)]: {
          display: 'flex',
          WebkitLineClamp: 'none',
          WebkitBoxOrient: 'unset',
          overflowY: 'auto',
          height: 'fit-content',
          ...(boundExpansion && expansionBounds),
        },
      }),
  });
}

export const getStyles: TableCellStyles = memoize((_theme, options) => buildAutoCellStyles(options, 'pre-line'), {
  isMatchingKey: isTableCellStylesKeyEqual,
});

// Nothing here overlaps the shared body, so composing the two classes is order-independent.
const jsonCellFont = css({ fontFamily: 'monospace' });

export const getJsonCellStyles: TableCellStyles = memoize(
  (_theme, options) => clsx(jsonCellFont, buildAutoCellStyles(options, 'pre-wrap', true)),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
