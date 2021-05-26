import React, { FC, useCallback } from 'react';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableCellProps } from './types';
import { Icon, Tooltip } from '..';

export const FilterActions: FC<TableCellProps> = ({ cell, field, tableStyles, onCellFilterAdded }) => {
  const onFilterFor = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) =>
      onCellFilterAdded({ key: field.name, operator: FILTER_FOR_OPERATOR, value: cell.value }),
    [cell, field, onCellFilterAdded]
  );
  const onFilterOut = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) =>
      onCellFilterAdded({ key: field.name, operator: FILTER_OUT_OPERATOR, value: cell.value }),
    [cell, field, onCellFilterAdded]
  );

  return (
    <div className={tableStyles.filterWrapper}>
      <div className={tableStyles.filterItem}>
        <Tooltip content="Filter for value" placement="top">
          <Icon name={'search-plus'} onClick={onFilterFor} />
        </Tooltip>
      </div>
      <div className={tableStyles.filterItem}>
        <Tooltip content="Filter out value" placement="top">
          <Icon name={'search-minus'} onClick={onFilterOut} />
        </Tooltip>
      </div>
    </div>
  );
};
