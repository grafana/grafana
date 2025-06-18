import { css } from '@emotion/css';
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
  direction?: SortDirection;
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
  direction,
  filter,
  setFilter,
  crossFilterOrder,
  crossFilterRows,
  showTypeIcons,
}) => {
  const styles = useStyles2(getStyles);
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
    <>
      <span className={styles.headerCellLabel}>
        {showTypeIcons && <Icon name={getFieldTypeIcon(field)} title={field?.type} size="sm" />}
        {/* Used cached displayName if available, otherwise use the column name (nested tables) */}
        <div>{getDisplayName(field)}</div>
        {direction && (direction === 'ASC' ? <Icon name="arrow-up" size="lg" /> : <Icon name="arrow-down" size="lg" />)}
      </span>

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
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
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
