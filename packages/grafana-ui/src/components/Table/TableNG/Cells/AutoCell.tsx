import { css } from '@emotion/css';
import memoize from 'micro-memoize';

import { formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { TABLE } from '../constants';
import { getActiveCellSelector, isTableCellStylesKeyEqual } from '../styles';
import { type AutoCellProps, type TableCellStyles } from '../types';

export function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {formattedValue}
    </MaybeWrapWithLink>
  );
}

export const getStyles: TableCellStyles = memoize(
  (_theme, { textWrap, shouldOverflow, maxHeight }) =>
    css({
      ...(textWrap && { whiteSpace: 'pre-line' }),
      ...(shouldOverflow && {
        [getActiveCellSelector(Boolean(maxHeight))]: {
          whiteSpace: 'pre-line',
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
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);

export const getJsonCellStyles: TableCellStyles = memoize(
  (_theme, { textWrap, shouldOverflow, maxHeight }) =>
    css({
      fontFamily: 'monospace',
      ...(textWrap && { whiteSpace: 'pre' }),
      ...(shouldOverflow && {
        [getActiveCellSelector(Boolean(maxHeight))]: {
          whiteSpace: 'pre',
        },
      }),
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
