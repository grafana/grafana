import React, { FC } from 'react';
import { Row } from 'react-table';

import { useStyles2 } from '../../themes';
import { Icon } from '../Icon/Icon';

import { getTableStyles } from './styles';

export interface Props {
  row: Row;
  expandedIndexes: Set<number>;
  setExpandedIndexes: (indexes: Set<number>) => void;
}

export const RowExpander: FC<Props> = ({ row, expandedIndexes, setExpandedIndexes }) => {
  const tableStyles = useStyles2(getTableStyles);
  const isExpanded = expandedIndexes.has(row.index);
  // Use Cell to render an expander for each row.
  // We can use the getToggleRowExpandedProps prop-getter
  // to build the expander.
  return (
    <div
      className={tableStyles.expanderCell}
      onClick={() => {
        const newExpandedIndexes = new Set(expandedIndexes);
        if (isExpanded) {
          newExpandedIndexes.delete(row.index);
        } else {
          newExpandedIndexes.add(row.index);
        }
        setExpandedIndexes(newExpandedIndexes);
      }}
    >
      <Icon
        aria-label={isExpanded ? 'Close trace' : 'Open trace'}
        name={isExpanded ? 'angle-down' : 'angle-right'}
        size="xl"
      />
    </div>
  );
};
