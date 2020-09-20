import React, { FC } from 'react';
import { TableCellProps } from './types';

export const ImageCell: FC<TableCellProps> = props => {
  const { cell, tableStyles, cellProps } = props;

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <img src={cell.value} className={tableStyles.imageCell} />
    </div>
  );
};
