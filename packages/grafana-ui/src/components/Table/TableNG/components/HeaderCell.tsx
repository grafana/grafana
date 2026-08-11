import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import React, { useEffect, useRef } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Column, type SortDirection } from '@grafana/react-data-grid';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Icon } from '../../../Icon/Icon';
import { Stack } from '../../../Layout/Stack/Stack';
import { Filter } from '../Filter/Filter';
import { type FilterType, type TableRow, type TableSummaryRow } from '../types';
import { getDisplayName } from '../utils';

import { HeaderCellMenu } from './HeaderCellMenu';

interface HeaderCellProps {
  column: Column<TableRow, TableSummaryRow>;
  rows: TableRow[];
  field: Field;
  direction?: SortDirection;
  filter: FilterType;
  setFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  showTypeIcons?: boolean;
  selectFirstCell: () => void;
  disableKeyboardEvents?: boolean;
  parentIndex?: number;
  crossFilterRows: Record<string, TableRow[]>;
  crossFilterTailRows: TableRow[];
  /** `table.refresh`: left-align the label and move the filter into a hover-revealed column menu. */
  tableRefreshEnabled?: boolean;
}

export const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  direction,
  disableKeyboardEvents,
  field,
  filter,
  rows,
  selectFirstCell,
  setFilter,
  showTypeIcons,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
  tableRefreshEnabled,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const sortable = field.config.custom?.sortable !== false;
  const styles = useStyles2(getStyles, headerCellWrap, sortable);
  const displayName = getDisplayName(field);
  const filterable = field.config.custom?.filterable ?? false;
  const hideHeader = field.config.custom?.hideHeader ?? false;
  const filterKey = typeof parentIndex === 'number' ? `${column.key}-${parentIndex}` : column.key;
  const hasActiveFilter = tableRefreshEnabled && filterable && filter[filterKey]?.filtered != null;

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

  if (hideHeader) {
    return null;
  }

  const onKeyDown = disableKeyboardEvents
    ? undefined
    : (ev: React.KeyboardEvent) => {
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
      };

  const label = (
    <>
      {showTypeIcons && (
        <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
      )}
      <button tabIndex={0} className={styles.headerCellLabel} title={displayName}>
        {displayName}
        {direction && (
          <Icon className={styles.headerCellIcon} size="lg" name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'} />
        )}
      </button>
      {/* the column menu is only revealed on hover, so an active filter needs a persistent marker of
          its own; it sits with the sort arrow because both report state rather than offering an action.
          Sized "sm" like the type icon rather than "lg" like the arrow: the funnel fills its box where
          the arrow is a thin glyph, so matching the arrow's nominal size reads far bigger than it. */}
      {hasActiveFilter && (
        <Icon
          className={styles.headerCellIcon}
          size="sm"
          name="filter"
          title={t('grafana-ui.table.column-filtered', 'Filtered')}
        />
      )}
    </>
  );

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  if (tableRefreshEnabled) {
    // Same DOM depth as the default branch below — the Tab handler above walks up from `ref` to the
    // react-data-grid header cell, so this root has to stay its direct child.
    return (
      <div ref={ref} className={styles.headerCellRoot} onKeyDown={onKeyDown}>
        <div className={styles.headerCellLabelGroup}>{label}</div>

        {filterable && (
          <div className={styles.headerCellActions}>
            <HeaderCellMenu
              name={column.key}
              displayName={displayName}
              field={field}
              filterable={filterable}
              filter={filter}
              setFilter={setFilter}
              parentIndex={parentIndex}
              crossFilterRows={crossFilterRows}
              crossFilterTailRows={crossFilterTailRows}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <Stack ref={ref} direction="row" gap={0.5} alignItems="center" onKeyDown={onKeyDown}>
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      {label}

      {filterable && (
        <Filter
          name={column.key}
          rows={rows}
          filter={filter}
          setFilter={setFilter}
          field={field}
          iconClassName={styles.headerCellIcon}
          parentIndex={parentIndex}
          crossFilterRows={crossFilterRows}
          crossFilterTailRows={crossFilterTailRows}
        />
      )}
    </Stack>
  );
};

const getStyles = memoize((theme: GrafanaTheme2, headerTextWrap?: boolean, sortable = true) => ({
  headerCellRoot: css({
    label: 'headerCellRoot',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    // fill the header cell so the actions can sit against its trailing edge
    flex: 1,
    minWidth: 0,
  }),
  headerCellLabelGroup: css({
    label: 'headerCellLabelGroup',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  headerCellActions: css({
    label: 'headerCellActions',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    marginLeft: 'auto',
  }),
  headerCellLabel: css({
    all: 'unset',
    cursor: sortable ? 'pointer' : 'default',
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: headerTextWrap ? 'pre-line' : 'nowrap',
    borderRadius: theme.spacing(0.25),
    lineHeight: '20px',
    '&:hover': {
      textDecoration: sortable ? 'underline' : 'none',
    },
    '&::selection': {
      backgroundColor: 'var(--rdg-background-color)',
      color: theme.colors.text.secondary,
    },
  }),
  headerCellIcon: css({
    color: theme.colors.text.secondary,
  }),
}));
