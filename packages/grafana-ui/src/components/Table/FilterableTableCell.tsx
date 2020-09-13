import React, { FC, useCallback, useState } from 'react';
import { TableCellProps } from 'react-table';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

import { stylesFactory, useTheme } from '../../themes';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR, TableFilterActionCallback } from './types';
import { Icon, Tooltip } from '..';
import { Props, renderCell } from './TableCell';

interface FilterableTableCellProps extends Pick<Props, 'cell' | 'field' | 'tableStyles'> {
  onCellFilterAdded: TableFilterActionCallback;
  cellProps: TableCellProps;
}

export const FilterableTableCell: FC<FilterableTableCellProps> = ({
  cell,
  field,
  tableStyles,
  onCellFilterAdded,
  cellProps,
}) => {
  const [showFilters, setShowFilter] = useState(false);
  const onMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => setShowFilter(true), [setShowFilter]);
  const onMouseLeave = useCallback((event: React.MouseEvent<HTMLDivElement>) => setShowFilter(false), [setShowFilter]);
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
  const theme = useTheme();
  const styles = getFilterableTableCellStyles(theme);

  return (
    <div {...cellProps} className={tableStyles.tableCellWrapper} onMouseOver={onMouseOver} onMouseLeave={onMouseLeave}>
      {renderCell(cell, field, tableStyles)}
      {showFilters && cell.value && (
        <div className={styles.filterWrapper}>
          <div className={styles.filterItem}>
            <Tooltip content="Filter for value" placement="top">
              <Icon name={'search-plus'} onClick={onFilterFor} />
            </Tooltip>
          </div>
          <div className={styles.filterItem}>
            <Tooltip content="Filter out value" placement="top">
              <Icon name={'search-minus'} onClick={onFilterOut} />
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

const getFilterableTableCellStyles = stylesFactory((theme: GrafanaTheme) => ({
  filterWrapper: css`
    label: filterWrapper;
    display: inline-flex;
    justify-content: space-around;
    cursor: pointer;
  `,
  filterItem: css`
    label: filterItem;
    color: ${theme.colors.textSemiWeak};
    padding: 0 ${theme.spacing.xxs};
  `,
}));
