import { css } from '@emotion/css';
import { Property } from 'csstype';
import React, { useEffect, useMemo } from 'react';
import { Column, SortDirection } from 'react-data-grid';

import { Field, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Icon } from '../../../Icon/Icon';
import { Filter } from '../Filter/Filter';
import { FilterType, TableRow, TableSummaryRow } from '../types';
import { getDisplayName } from '../utils';

interface HeaderCellProps {
  column: Column<TableRow, TableSummaryRow>;
  rows: TableRow[];
  field: Field;
  onSort: (columnKey: string, direction: SortDirection, isMultiSort: boolean) => void;
  direction?: SortDirection;
  justifyContent: Property.JustifyContent;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  crossFilterOrder: string[];
  crossFilterRows: { [key: string]: TableRow[] };
  showTypeIcons?: boolean;
}

const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  rows,
  field,
  onSort,
  direction,
  justifyContent,
  filter,
  setFilter,
  crossFilterOrder,
  crossFilterRows,
  showTypeIcons,
}) => {
  const styles = useStyles2(getStyles, justifyContent);
  const displayName = useMemo(() => getDisplayName(field), [field]);
  const filterable = useMemo(() => field.config.custom?.filterable ?? false, [field]);

  // we have to remove/reset the filter if the column is not filterable
  useEffect(() => {
    if (!filterable && filter[displayName]) {
      setFilter((filter: FilterType) => {
        const newFilter = { ...filter };
        delete newFilter[displayName];
        return newFilter;
      });
    }
  }, [filterable, displayName, filter, setFilter]);

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.headerCell}
      // TODO find a better solution to this issue, see: https://github.com/adazzle/react-data-grid/issues/3535
      // Unblock spacebar event
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.stopPropagation();
        }
      }}
    >
      <button
        className={styles.headerCellLabel}
        onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
          const isMultiSort = event.shiftKey;
          onSort(column.key, direction === 'ASC' ? 'DESC' : 'ASC', isMultiSort);
        }}
      >
        {showTypeIcons && <Icon name={getFieldTypeIcon(field)} title={field?.type} size="sm" />}
        {/* Used cached displayName if available, otherwise use the column name (nested tables) */}
        <div>{getDisplayName(field)}</div>
        {direction && (direction === 'ASC' ? <Icon name="arrow-up" size="lg" /> : <Icon name="arrow-down" size="lg" />)}
      </button>

      {filterable && (
        <Filter
          name={column.key}
          rows={rows}
          filter={filter}
          setFilter={setFilter}
          field={field}
          crossFilterOrder={crossFilterOrder}
          crossFilterRows={crossFilterRows}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justifyContent: Property.JustifyContent) => ({
  headerCell: css({
    display: 'flex',
    gap: theme.spacing(0.5),
    justifyContent,
  }),
  headerCellLabel: css({
    border: 'none',
    padding: 0,
    background: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    gap: theme.spacing(1),

    '&:hover': {
      textDecoration: 'underline',
      color: theme.colors.text.link,
    },
  }),
});

export { HeaderCell };
