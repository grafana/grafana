import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';
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
  selectFirstCell: () => void;
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
  selectFirstCell,
}) => {
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const styles = useStyles2(getStyles, headerCellWrap);
  const displayName = getDisplayName(field);
  const filterable = field.config.custom?.filterable ?? false;

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

  // unfortunately, react-data-grid's default keyboard behavior is not compatible with what we need
  // to do to make filter and sort keyboard accessible, so we have to implement it ourselves here, including
  // a way to "hook back in" to their behavior once you've reached the last tabbable element in the last header cell.
  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <div
      tabIndex={-1}
      onKeyDown={(ev) => {
        ev.stopPropagation();

        const tableTabbedElement = ev.target;
        const headerContent = ev.currentTarget;
        const headerCell = ev.currentTarget.parentNode;
        const row = headerCell?.parentNode;
        const isLastTabKeypressInHeader =
          ev.key === 'Tab' &&
          !ev.shiftKey &&
          tableTabbedElement === headerContent.lastElementChild &&
          headerCell === row?.lastElementChild;

        if (isLastTabKeypressInHeader) {
          console.log('selecting first cell');
          selectFirstCell();
        }
      }}
    >
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      {showTypeIcons && (
        <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
      )}
      <button tabIndex={0} className={styles.headerCellLabel} title={displayName}>
        {displayName}
      </button>
      {direction && (
        <Icon
          className={cx(styles.headerCellIcon, styles.headerSortIcon)}
          size="lg"
          name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
        />
      )}
      {filterable && (
        <Filter
          name={column.key}
          rows={rows}
          filter={filter}
          setFilter={setFilter}
          field={field}
          crossFilterOrder={crossFilterOrder}
          crossFilterRows={crossFilterRows}
          iconClassName={styles.headerCellIcon}
        />
      )}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, headerTextWrap?: boolean) => ({
  headerCellLabel: css({
    all: 'unset',
    cursor: 'pointer',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: headerTextWrap ? 'pre-line' : 'nowrap',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    marginBottom: theme.spacing(0.5),
    alignSelf: 'flex-end',
    color: theme.colors.text.secondary,
  }),
  headerSortIcon: css({
    marginBottom: theme.spacing(0.25),
  }),
});

export { HeaderCell };
