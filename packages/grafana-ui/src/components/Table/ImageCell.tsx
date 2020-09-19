import React, { FC } from 'react';
import { TableCellProps } from './types';

export const ImageCell: FC<TableCellProps> = props => {
  const { cell, tableStyles } = props;

  return (
    <div className={tableStyles.tableCell}>
      <img src={cell.value} className={tableStyles.imageCell} />
    </div>
  );
};
