import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type Column, type SortDirection } from '@grafana/react-data-grid';

import { useStyles2 } from '../../../../themes/ThemeContext';
import { getFieldTypeIcon } from '../../../../types/icon';
import { Icon } from '../../../Icon/Icon';
import { IconButton } from '../../../IconButton/IconButton';
import { Stack } from '../../../Layout/Stack/Stack';
import { Popover } from '../../../Tooltip/Popover';
import { Filter } from '../Filter/Filter';
import { FilterPopup } from '../Filter/FilterPopup';
import { useFilterPopupState } from '../Filter/useFilterPopupState';
import { type FilterType, type TableRow, type TableSummaryRow } from '../types';
import { getDisplayName, isSortableField } from '../utils';

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

// Everything the header cell can put in the tab order: buttons, plus anything opting in with a
// tabindex. The filter popup and column menu portal out of the cell, so their contents never match.
const TABBABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const sortable = isSortableField(field);
  const styles = useStyles2(getStyles, headerCellWrap, sortable);
  const displayName = getDisplayName(field);
  const filterable = field.config.custom?.filterable ?? false;
  const hideHeader = field.config.custom?.hideHeader ?? false;
  const headerTooltip = field.config.custom?.headerTooltip;

  const filterKey = typeof parentIndex === 'number' ? `${column.key}-${parentIndex}` : column.key;
  const hasActiveFilter = filterable && filter[filterKey]?.filtered != null;

  // The filter popup is shared by the two controls that open it — the column menu's "Filter values"
  // item and the filter icon that marks an already-filtered column — so it lives here rather than in
  // either one. `filterAnchor` is whichever control opened it, so the popup lands under that control
  // and returns focus to it on close.
  const filterIconRef = useRef<HTMLButtonElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const { isPopoverVisible, setPopoverVisible, popupProps } = useFilterPopupState({
    name: column.key,
    filter,
    setFilter,
    field,
    parentIndex,
    crossFilterRows,
    crossFilterTailRows,
  });

  const openFilter = useCallback(
    (anchor: HTMLButtonElement | null) => {
      setFilterAnchor(anchor);
      setPopoverVisible(true);
    },
    [setPopoverVisible]
  );

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

  let onKeyDown: React.KeyboardEventHandler | undefined;
  if (!disableKeyboardEvents) {
    onKeyDown = (ev: React.KeyboardEvent) => {
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
      const headerCell = headerContent?.parentNode;
      const row = headerCell?.parentNode;
      if (!headerContent || headerCell !== row?.lastElementChild) {
        return;
      }

      // Compare against the last tabbable element itself rather than assuming the header's last child
      // element holds it: under `table.refresh` the title, tooltip and active-filter icon share one
      // wrapper, so tabbing from the title would otherwise look like tabbing out of the header and
      // skip the controls after it.
      const tabbables = headerContent.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
      if (tabbables[tabbables.length - 1] === tableTabbedElement) {
        selectFirstCell();
      }
    };
  }

  const label = (
    <>
      {showTypeIcons && (
        <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
      )}
      <button
        tabIndex={0}
        className={clsx(styles.headerCellLabel, tableRefreshEnabled && styles.headerCellLabelPrimary)}
        title={displayName}
      >
        {displayName}
        {direction && (
          <Icon className={styles.headerCellIcon} size="lg" name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'} />
        )}
      </button>
      {headerTooltip && (
        <IconButton
          name="info-circle"
          size="sm"
          tooltip={headerTooltip}
          className={styles.headerTooltipIcon}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        />
      )}
      {/* The column menu is only revealed on hover, so an active filter needs a persistent marker of
          its own; it sits with the sort arrow because both report the column's state. It doubles as a
          shortcut back into the filter popup, so the filter can be adjusted or cleared without going
          through the menu. Sized "sm" like the type icon rather than "lg" like the arrow: the funnel
          fills its box where the arrow is a thin glyph, so the arrow's nominal size reads far bigger. */}
      {tableRefreshEnabled && hasActiveFilter && (
        <button
          ref={filterIconRef}
          type="button"
          className={styles.headerCellFilterButton}
          aria-label={t('grafana-ui.table.edit-column-filter', 'Edit filter on {{name}}', { name: displayName })}
          aria-haspopup="dialog"
          // The popup is shared with the column menu's "Filter values" item, so `isPopoverVisible`
          // alone would have this button claim a popup that the menu opened. `filterAnchor` is
          // whichever control opened it, which is what makes the distinction.
          aria-expanded={isPopoverVisible && filterAnchor === filterIconRef.current}
          data-testid={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.activeFilterButton}
          onClick={(ev) => {
            // the header cell itself sorts on click, so this must not bubble
            ev.stopPropagation();
            openFilter(filterIconRef.current);
          }}
          onMouseDown={(ev) => ev.stopPropagation()}
        >
          <Icon className={styles.headerCellIcon} size="sm" name="filter" />
        </button>
      )}
    </>
  );

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  if (tableRefreshEnabled) {
    // Same DOM depth as the default branch below — the Tab handler above walks up from `ref` to the
    // react-data-grid header cell, so this root has to stay its direct child.
    return (
      // A nested table's own header cells sit inside the outer grid's nested-frame cell, so
      // `:hover`/`:focus-within` on that outer `.rdg-cell` would otherwise reveal every column's
      // menu at once. `table-ng-header-cell` gives HeaderCellMenu something to scope to that's
      // unique per column, regardless of how deep it sits in a nested table.
      <div ref={ref} className={clsx(styles.headerCellRoot, 'table-ng-header-cell')} onKeyDown={onKeyDown}>
        <div className={styles.headerCellLabelGroup}>{label}</div>

        {filterable && (
          <div className={styles.headerCellActions}>
            <HeaderCellMenu
              displayName={displayName}
              filterable={filterable}
              hasActiveFilter={hasActiveFilter}
              onOpenFilter={openFilter}
            />
          </div>
        )}

        {isPopoverVisible && filterAnchor && (
          // `Popover` portals out of the header cell, but React events still bubble along the React
          // tree, so a click inside the popup would otherwise reach react-data-grid's sort handler
          // and re-sort the column while the user is picking values.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div onClick={(ev) => ev.stopPropagation()} onMouseDown={(ev) => ev.stopPropagation()}>
            <Popover
              content={<FilterPopup {...popupProps} buttonElement={filterAnchor} />}
              // opens rightward from whichever control was used, rather than back across the column
              placement="bottom-start"
              referenceElement={filterAnchor}
              show
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
      color: 'inherit',
    },
  }),
  // `table.refresh` gives the header its own background, so the label no longer needs to be
  // de-emphasised against the body rows to read as a header — it takes the body text colour.
  headerCellLabelPrimary: css({
    label: 'headerCellLabelPrimary',
    color: theme.colors.text.primary,
  }),
  headerCellIcon: css({
    color: theme.colors.text.secondary,
  }),
  headerTooltipIcon: css({
    cursor: 'default',
  }),
  // Wraps the filter icon without changing how it reads: no padding, border or background, so the
  // button box is exactly the icon and the header's spacing and reserved width are unaffected.
  headerCellFilterButton: css({
    label: 'headerCellFilterButton',
    display: 'flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    borderRadius: theme.spacing(0.25),
  }),
}));
