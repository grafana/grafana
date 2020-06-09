import React, { FC, useCallback, useState } from 'react';
import { TableCellProps } from 'react-table';
import { GrafanaTheme } from '@grafana/data';
import { css, cx } from 'emotion';

import { stylesFactory, useTheme } from '../../themes';
import { TableStyles } from './styles';
import { TableFilterActionCallback } from './types';
import { Icon, Tooltip } from '..';
import { Props, renderCell } from './TableCell';

interface FilterableTableCellProps extends Pick<Props, 'cell' | 'field' | 'tableStyles'> {
  onFilterAdded: TableFilterActionCallback;
  cellProps: TableCellProps;
}

export const FilterableTableCell: FC<FilterableTableCellProps> = ({
  cell,
  field,
  tableStyles,
  onFilterAdded,
  cellProps,
}) => {
  const [showFilters, setShowFilter] = useState(false);
  const onMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => setShowFilter(true), [setShowFilter]);
  const onMouseLeave = useCallback((event: React.MouseEvent<HTMLDivElement>) => setShowFilter(false), [setShowFilter]);
  const onFilterFor = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => onFilterAdded({ key: field.name, operator: '=', value: cell.value }),
    [cell, field, onFilterAdded]
  );
  const onFilterOut = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => onFilterAdded({ key: field.name, operator: '!=', value: cell.value }),
    [cell, field, onFilterAdded]
  );
  const theme = useTheme();
  const styles = getFilterableTableCellStyles(theme, tableStyles);

  return (
    <div
      {...cellProps}
      className={showFilters ? styles.tableCellWrapper : tableStyles.tableCellWrapper}
      onMouseOver={onMouseOver}
      onMouseLeave={onMouseLeave}
    >
      {renderCell(cell, field, tableStyles)}
      {showFilters && cell.value && (
        <div className={styles.filterWrapper}>
          <div className={styles.filterItem}>
            <Tooltip content="Filter for value">
              <Icon name={'search-plus'} onClick={onFilterFor} />
            </Tooltip>
          </div>
          <div className={styles.filterItem}>
            <Tooltip content="Filter out value">
              <Icon name={'search-minus'} onClick={onFilterOut} />
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
};

const getFilterableTableCellStyles = stylesFactory((theme: GrafanaTheme, tableStyles: TableStyles) => ({
  tableCellWrapper: cx(
    tableStyles.tableCellWrapper,
    css`
      display: inline-flex;
      justify-content: space-between;
      align-items: center;
    `
  ),
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
