import { css } from '@emotion/css';
import React, { useEffect, useRef } from 'react';
import { Column, SortDirection } from 'react-data-grid';

import { Field, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Icon } from '../../../Icon/Icon';
import { Stack } from '../../../Layout/Stack/Stack';
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
  disableKeyboardEvents?: boolean;
}

const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  crossFilterOrder,
  crossFilterRows,
  direction,
  disableKeyboardEvents,
  field,
  filter,
  rows,
  selectFirstCell,
  setFilter,
  showTypeIcons,
}) => {
  const ref = useRef<HTMLDivElement>(null);
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

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  return (
    <Stack
      ref={ref}
      direction="row"
      gap={0.5}
      alignItems="center"
      onKeyDown={
        disableKeyboardEvents
          ? undefined
          : (ev) => {
              // unfortunately, react-data-grid's default keyboard behavior is not compatible with what we need
              // to do to make filter and sort keyboard accessible, so we have to stop the propagation of events here,
              // and add a way to "hook back in" to their behavior once you've reached the last tabbable element in the last header cell.
              ev.stopPropagation();

              if (!(ev.key === 'Tab' && !ev.shiftKey)) {
                return;
              }

              const tableTabbedElement = ev.target;
              if (!(tableTabbedElement instanceof HTMLElement)) {
                return;
              }

              const headerContent = ref.current;
              const headerCell = ref.current?.parentNode;
              const row = headerCell?.parentNode;
              const isLastElementInHeader =
                headerContent?.lastElementChild?.contains(tableTabbedElement) && headerCell === row?.lastElementChild;

              if (isLastElementInHeader) {
                selectFirstCell();
              }
            }
      }
    >
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      {showTypeIcons && (
        <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
      )}
      <button tabIndex={0} className={styles.headerCellLabel} title={displayName}>
        {displayName}
        {direction && (
          <Icon className={styles.headerCellIcon} size="lg" name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'} />
        )}
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
          iconClassName={styles.headerCellIcon}
        />
      )}
    </Stack>
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
    borderRadius: theme.spacing(0.25),
    lineHeight: '20px',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    color: theme.colors.text.secondary,
  }),
});

export { HeaderCell };
