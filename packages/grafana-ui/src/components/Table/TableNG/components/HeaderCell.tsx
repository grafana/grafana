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
import { HEADER_DRAG_HANDLE_WIDTH, TABLE } from '../constants';
import { type FilterType, type TableRow, type TableSummaryRow } from '../types';
import {
  getDisplayName,
  isColumnMenuVisible,
  isFieldFilterable,
  isFieldHideable,
  isFieldReorderable,
  isSortableField,
} from '../utils';

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
  tableRefreshEnabled?: boolean;
  hasColumnSidebar?: boolean;
  onHideColumn?: () => void;
  canHideColumn?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onOpenColumnPanel?: () => void;
}

const TABBABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HEADER_LINE_BOX = `${TABLE.HEADER_LINE_HEIGHT}px`;

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
  hasColumnSidebar,
  onHideColumn,
  canHideColumn,
  isPinned,
  onTogglePin,
  onOpenColumnPanel,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const sortable = isSortableField(field);
  const styles = useStyles2(getStyles, headerCellWrap, sortable, tableRefreshEnabled);
  const controlAlignment = headerCellWrap ? 'flex-end' : 'center';
  const displayName = getDisplayName(field);
  const filterable = isFieldFilterable(field);
  const hideable = isFieldHideable(field);
  const reorderable = isFieldReorderable(field);
  const hideHeader = field.config.custom?.hideHeader ?? false;
  const headerTooltip = field.config.custom?.headerTooltip;

  const filterKey = typeof parentIndex === 'number' ? `${column.key}-${parentIndex}` : column.key;
  const hasActiveFilter = filterable && filter[filterKey]?.filtered != null;
  const canOpenColumnPanel = Boolean(onOpenColumnPanel) && Boolean(hasColumnSidebar);

  // The menu item and active-filter icon share this popup.
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

      // The last tabbable control may be nested inside the label wrapper.
      const tabbables = headerContent.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
      if (tabbables[tabbables.length - 1] === tableTabbedElement) {
        selectFirstCell();
      }
    };
  }

  const hasTrailingControls = Boolean(
    (tableRefreshEnabled && direction) || headerTooltip || (tableRefreshEnabled && hasActiveFilter)
  );

  const sortArrow = direction && (
    <Icon
      className={clsx(styles.headerCellIcon, tableRefreshEnabled && styles.headerCellSortIcon)}
      size="lg"
      name={direction === 'ASC' ? 'arrow-up' : 'arrow-down'}
    />
  );

  const label = (
    <>
      {showTypeIcons && (
        <Stack alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
          <Icon className={styles.headerCellIcon} name={getFieldTypeIcon(field)} title={field?.type} size="sm" />
        </Stack>
      )}
      <button tabIndex={0} className={styles.headerCellLabel} title={displayName}>
        {displayName}
        {!tableRefreshEnabled && sortArrow}
      </button>
      {hasTrailingControls && (
        <Stack direction="row" gap={0.5} alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
          {/* Keep state icons outside the label's clipped overflow. */}
          {tableRefreshEnabled && sortArrow}
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
          {/* The hover-only menu needs a persistent marker for active filters. */}
          {tableRefreshEnabled && hasActiveFilter && (
            <button
              ref={filterIconRef}
              type="button"
              className={styles.headerCellFilterButton}
              aria-label={t('grafana-ui.table.edit-column-filter', 'Edit filter on {{name}}', { name: displayName })}
              aria-haspopup="dialog"
              aria-expanded={isPopoverVisible && filterAnchor === filterIconRef.current}
              data-testid={selectors.components.Panels.Visualization.TableNG.headerColumnMenu.activeFilterButton}
              onClick={(ev) => {
                ev.stopPropagation();
                openFilter(filterIconRef.current);
              }}
              onMouseDown={(ev) => ev.stopPropagation()}
            >
              <Icon className={styles.headerCellIcon} size="sm" name="filter" />
            </button>
          )}
        </Stack>
      )}
    </>
  );

  /* eslint-disable jsx-a11y/no-static-element-interactions */
  if (tableRefreshEnabled) {
    return (
      // Scope hover styles to this header instead of an ancestor nested-table cell.
      <div ref={ref} className={clsx(styles.headerCellRoot, 'table-ng-header-cell')} onKeyDown={onKeyDown}>
        {reorderable && (
          // Chrome requires an interactive drag target inside the draggable header.
          <button type="button" tabIndex={-1} aria-hidden="true" className={styles.headerCellDragHandle}>
            <Icon name="draggabledots" aria-hidden="true" />
          </button>
        )}
        <Stack direction="row" gap={0.5} alignItems={controlAlignment} grow={1} minWidth={0}>
          {label}
        </Stack>

        {isColumnMenuVisible(field, Boolean(hasColumnSidebar)) && (
          <Stack direction="row" gap={0.5} alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
            <HeaderCellMenu
              displayName={displayName}
              filterable={filterable}
              hasActiveFilter={hasActiveFilter}
              onOpenFilter={openFilter}
              onHideColumn={hideable ? onHideColumn : undefined}
              canHideColumn={canHideColumn}
              isPinned={isPinned}
              onTogglePin={onTogglePin}
              onOpenColumnPanel={canOpenColumnPanel ? onOpenColumnPanel : undefined}
            />
          </Stack>
        )}

        {isPopoverVisible && filterAnchor && (
          // Portalled React events still bubble to react-data-grid's sort handler.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div onClick={(ev) => ev.stopPropagation()} onMouseDown={(ev) => ev.stopPropagation()}>
            <Popover
              content={<FilterPopup {...popupProps} buttonElement={filterAnchor} />}
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
    <Stack ref={ref} direction="row" gap={0.5} alignItems={controlAlignment} onKeyDown={onKeyDown}>
      {/* eslint-enable jsx-a11y/no-static-element-interactions */}
      {label}

      {filterable && (
        <Stack alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
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
        </Stack>
      )}
    </Stack>
  );
};

const getStyles = memoize(
  (theme: GrafanaTheme2, headerTextWrap?: boolean, sortable = true, tableRefreshEnabled = false) => ({
    headerCellRoot: css({
      label: 'headerCellRoot',
      display: 'flex',
      alignItems: headerTextWrap ? 'flex-end' : 'center',
      gap: theme.spacing(0.5),
      flex: 1,
      minWidth: 0,
      // Prevent text selection from stealing the column drag gesture.
      userSelect: 'none',
    }),
    // Keep the handle mounted so its width can animate without shifting the label abruptly.
    headerCellDragHandle: css({
      label: 'headerCellDragHandle',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      background: 'transparent',
      border: 'none',
      padding: 0,
      color: theme.colors.text.secondary,
      cursor: 'grab',
      width: 0,
      opacity: 0,
      overflow: 'hidden',
      marginInlineEnd: theme.spacing(-0.5),
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['width', 'opacity', 'margin-inline-end'], {
          duration: theme.transitions.duration.shorter,
        }),
      },
      // The custom class avoids matching the outer cell of a nested table.
      '.table-ng-header-cell:hover &': {
        width: HEADER_DRAG_HANDLE_WIDTH,
        opacity: 1,
        marginInlineEnd: 0,
      },
    }),
    // The `table.refresh` differences live in this one rule rather than in a second class composed
    // over it: two rules of equal specificity are resolved by their order in the stylesheet, and this
    // one's hash changes with `headerTextWrap`, so toggling "Wrap header text" re-inserted it *after*
    // the override and the label lost its colour.
    headerCellLabel: css({
      all: 'unset',
      cursor: sortable ? 'pointer' : 'default',
      fontWeight: theme.typography.fontWeightMedium,
      // `table.refresh` gives the header its own background, so the label no longer needs to be
      // de-emphasised against the body rows to read as a header — it takes the body text colour.
      color: tableRefreshEnabled ? theme.colors.text.primary : theme.colors.text.secondary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: headerTextWrap ? 'pre-line' : 'nowrap',
      borderRadius: theme.spacing(0.25),
      lineHeight: `${TABLE.HEADER_LINE_HEIGHT}px`,
      // A flex item won't shrink below its own min-content width by default, which for a `nowrap`
      // label is the whole title — so `overflow: hidden` and the ellipsis above never engage and the
      // title runs under the column menu pinned to the trailing edge. Allow it to shrink instead.
      ...(tableRefreshEnabled && { minWidth: 0 }),
      '&:hover': {
        textDecoration: sortable ? 'underline' : 'none',
      },
      '&::selection': {
        backgroundColor: 'var(--rdg-background-color)',
        color: 'inherit',
      },
    }),
    headerCellIcon: css({
      color: theme.colors.text.secondary,
    }),
    // The sort arrow reports the column's state, so it keeps its full size while the title beside it
    // gives up width to the trailing controls.
    headerCellSortIcon: css({
      label: 'headerCellSortIcon',
      flexShrink: 0,
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
  })
);
