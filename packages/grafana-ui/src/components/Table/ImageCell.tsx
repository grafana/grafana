import React, { FC } from 'react';
import { TableCellProps } from './types';
import { getTextAlign } from './utils';

export const ImageCell: FC<TableCellProps> = props => {
  const { cell, tableStyles, field } = props;
  const cellProps = cell.getCellProps();

  const cellStyle = tableStyles.getCellStyle({ justify: getTextAlign(field) });

  return (
    <div {...cellProps} className={cellStyle}>
      <img src={cell.value} className={tableStyles.imageCell} />
    </div>
  );
};
