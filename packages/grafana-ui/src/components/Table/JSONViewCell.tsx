import React from 'react';
import { css, cx } from '@emotion/css';
import { isString } from 'lodash';
import { TableCellProps } from './types';

export function JSONViewCell(props: TableCellProps): JSX.Element {
  const { cell, tableStyles, cellProps } = props;

  const txt = css`
    cursor: pointer;
    font-family: monospace;
  `;

  let value = cell.value;
  let displayValue = value;

  if (isString(value)) {
    try {
      value = JSON.parse(value);
    } catch {} // ignore errors
  } else {
    displayValue = JSON.stringify(value, null, ' ');
  }

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <div className={cx(tableStyles.cellText, txt)}>{displayValue}</div>
    </div>
  );
}
