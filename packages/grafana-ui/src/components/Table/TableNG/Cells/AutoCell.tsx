import { css } from '@emotion/css';

import { formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { TABLE } from '../constants';
import { getActiveCellSelector } from '../styles';
import { AutoCellProps, TableCellStyles } from '../types';

export function AutoCell({ value, field, rowIdx }: AutoCellProps) {
  const displayValue = field.display!(value);
  const formattedValue = formattedValueToString(displayValue);
  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {formattedValue}
    </MaybeWrapWithLink>
  );
}

export const getStyles: TableCellStyles = (_theme, { textWrap, shouldOverflow, maxHeight }) =>
  css({
    ...(textWrap && { whiteSpace: 'pre-line' }),
    ...(shouldOverflow && {
      [getActiveCellSelector(Boolean(maxHeight))]: {
        whiteSpace: 'pre-line',
      },
    }),
    ...(maxHeight != null &&
      textWrap && {
        [`:not(${getActiveCellSelector(true)}`]: {
          height: 'auto',
          overflowY: 'hidden',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: Math.floor(maxHeight / TABLE.LINE_HEIGHT),
        },
      }),
  });

export const getJsonCellStyles: TableCellStyles = (_theme, { textWrap, shouldOverflow, maxHeight }) =>
  css({
    fontFamily: 'monospace',
    ...(textWrap && { whiteSpace: 'pre' }),
    ...(shouldOverflow && {
      [getActiveCellSelector(Boolean(maxHeight))]: {
        whiteSpace: 'pre',
      },
    }),
  });
