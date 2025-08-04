import { css } from '@emotion/css';

import { formattedValueToString } from '@grafana/data';

import { MaybeWrapWithLink } from '../MaybeWrapWithLink';
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

export const getStyles: TableCellStyles = (_theme, { textWrap, shouldOverflow }) =>
  css({
    ...(textWrap && { whiteSpace: 'pre-line' }),
    ...(shouldOverflow && {
      '&:hover, &[aria-selected=true]': {
        whiteSpace: 'pre-line',
      },
    }),
  });

export const getColorCellStyles: TableCellStyles = () =>
  css({
    // helps when cells have a bg color
    backgroundClip: 'padding-box !important',
    a: {
      color: 'inherit',
      textDecoration: 'underline',
    },
  });

export const getJsonCellStyles: TableCellStyles = (_theme, { textWrap, shouldOverflow }) =>
  css({
    fontFamily: 'monospace',
    ...(textWrap && { whiteSpace: 'pre' }),
    ...(shouldOverflow && {
      '&:hover, &[aria-selected=true]': {
        whiteSpace: 'pre',
      },
    }),
  });
