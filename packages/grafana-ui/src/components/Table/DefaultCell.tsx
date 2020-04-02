import React, { FC } from 'react';
import { TableCellProps } from './types';
import { formattedValueToString } from '@grafana/data';
import { css } from 'emotion';

export const DefaultCell: FC<TableCellProps> = props => {
  const { field, cell, tableStyles, textAlign } = props;
  if (!field.display) {
    return null;
  }

  const style = css`
    ${tableStyles.tableCell};
    text-align: ${textAlign};
  `;
  const displayValue = field.display(cell.value);

  return <div className={style}>{formattedValueToString(displayValue)}</div>;
};

export const RightAlignedCell: FC<TableCellProps> = props => {
  return <DefaultCell {...props} textAlign={'right'} />;
};

export const CenterAlignedCell: FC<TableCellProps> = props => {
  return <DefaultCell {...props} textAlign={'center'} />;
};
