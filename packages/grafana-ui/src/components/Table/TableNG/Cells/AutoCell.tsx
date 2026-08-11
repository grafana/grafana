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
  // unbounded cell grows past the panel and puts its own content out of reach. Only applies without
  // a maxHeight, where these land on the cell root — the row-height clamp below already bounds the
  // cell, and with it set these styles go to the inner content element instead.
  boundExpansion = false
) {
  return css({
    ...(textWrap && { whiteSpace }),
    ...(shouldOverflow && {
      [getActiveCellSelector(Boolean(maxHeight))]: {
        whiteSpace,
        ...(boundExpansion &&
          maxHeight == null && {
            maxWidth: TABLE.JSON_OVERFLOW_MAX_WIDTH,
            maxHeight: TABLE.JSON_OVERFLOW_MAX_HEIGHT,
            overflowY: 'auto',
          }),
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
