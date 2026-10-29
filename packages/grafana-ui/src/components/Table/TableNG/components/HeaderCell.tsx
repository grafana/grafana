import { css } from '@emotion/css';
import { clsx } from 'clsx';
import memoize from 'micro-memoize';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type Field, type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { faro, LogLevel } from '@grafana/faro-web-sdk';
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
import { useTableFilters } from '../TableFilterContext';
import { HEADER_DRAG_HANDLE_WIDTH, TABLE } from '../constants';
import { getColumnMenuOptions } from '../menuOptions';
import { type TableRow, type TableSummaryRow, type TableWarning } from '../types';
import { getDisplayName, isFieldFilterable, isFieldHideable, isSortableField } from '../utils';

import { HeaderCellMenu } from './HeaderCellMenu';
import { TableWarnings } from './TableWarnings';

interface HeaderCellProps {
  warnings?: readonly TableWarning[];
  onAddToAssistant?: () => void;
  column: Column<TableRow, TableSummaryRow>;
  rows: TableRow[];
  field: Field;
  timeZone?: string;
  direction?: SortDirection;
  showTypeIcons?: boolean;
  selectFirstCell: () => void;
  disableKeyboardEvents?: boolean;
  parentIndex?: number;
  crossFilterRows: Record<string, () => TableRow[]>;
  crossFilterTailRows: TableRow[];
  tableRefreshEnabled?: boolean;
  hasColumnSidebar?: boolean;
  onHideColumn?: () => void;
  canHideColumn?: boolean;
  onOpenColumnPanel?: (columnKey: string) => void;
}

const TABBABLE_SELECTOR = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HEADER_LINE_BOX = `${TABLE.HEADER_LINE_HEIGHT}px`;

export const HeaderCell: React.FC<HeaderCellProps> = ({
  column,
  direction,
  disableKeyboardEvents,
  field,
  timeZone,
  rows,
  selectFirstCell,
  showTypeIcons,
  parentIndex,
  crossFilterRows,
  crossFilterTailRows,
  tableRefreshEnabled,
  hasColumnSidebar,
  onHideColumn,
  canHideColumn,
  onOpenColumnPanel,
  onAddToAssistant,
  warnings = [],
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const headerCellWrap = field.config.custom?.wrapHeaderText ?? false;
  const sortable = isSortableField(field);
  const styles = useStyles2(getStyles, headerCellWrap, sortable, tableRefreshEnabled);
  const controlAlignment = headerCellWrap ? 'flex-end' : 'center';
  const displayName = getDisplayName(field);
  const filterable = isFieldFilterable(field);
  const tableFilters = useTableFilters();
  const filteringDisabled = tableFilters?.filteringDisabled;
  const hideable = isFieldHideable(field);
  const reorderable = column.draggable ?? false;
  const hideHeader = field.config.custom?.hideHeader ?? false;
  const headerTooltip = field.config.custom?.headerTooltip ?? field.config.description;

  // The menu item and active-filter icon share this popup.
  const filterIconRef = useRef<HTMLButtonElement>(null);
  const [filterAnchor, setFilterAnchor] = useState<HTMLButtonElement | null>(null);
  const { isPopoverVisible, setPopoverVisible, popupProps, filterEnabled, unsupportedReason } = useFilterPopupState({
    name: column.key,
    field,
    timeZone,
    parentIndex,
    crossFilterRows,
    crossFilterTailRows,
  });

  const showFilterControl = filterable && !unsupportedReason;
  const columnOptions = getColumnMenuOptions({
    filterable: showFilterControl && !filteringDisabled,
    hideable: hideable && Boolean(onHideColumn),
    hasColumnSidebar: Boolean(hasColumnSidebar && onOpenColumnPanel),
    hasAssistantAction: Boolean(onAddToAssistant),
  });
  const hasActiveFilter = showFilterControl && filterEnabled && !filteringDisabled;

  useEffect(() => {
    if (filterable && unsupportedReason) {
      faro?.api?.pushLog(['Table filter is not editable in the header; filter control hidden.'], {
        level: LogLevel.WARN,
        context: { source: 'TableNG.HeaderCell', reason: unsupportedReason },
      });
    }
  }, [filterable, unsupportedReason]);

  const openFilter = useCallback(
    (anchor: HTMLButtonElement | null) => {
      setFilterAnchor(anchor);
      setPopoverVisible(true);
    },
    [setPopoverVisible]
  );

  useEffect(() => {
    if (!filteringDisabled && !filterable && filterEnabled && !unsupportedReason) {
      tableFilters?.clearFilter(field, parentIndex);
    }
  }, [filterable, filterEnabled, filteringDisabled, unsupportedReason, tableFilters, field, parentIndex]);

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
      <TableWarnings warnings={warnings} scope="field" />
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
              aria-label={t('grafana-ui.table.edit-column-filter', 'Edit filter on {{name}}', {
                name: displayName,
                interpolation: { escapeValue: false },
              })}
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
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={styles.headerCellDragHandle}
            onClick={(event) => event.stopPropagation()}
          >
            <Icon name="draggabledots" aria-hidden="true" />
          </button>
        )}
        <Stack direction="row" gap={0.5} alignItems={controlAlignment} grow={1} minWidth={0}>
          {label}
        </Stack>

        {columnOptions.length > 0 && (
          <Stack direction="row" gap={0.5} alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
            <HeaderCellMenu
              displayName={displayName}
              groups={columnOptions}
              hasActiveFilter={hasActiveFilter}
              isFilterOpen={isPopoverVisible && filterAnchor !== filterIconRef.current}
              onOpenFilter={openFilter}
              onHideColumn={hideable ? onHideColumn : undefined}
              canHideColumn={canHideColumn}
              onOpenColumnPanel={() => onOpenColumnPanel?.(column.key)}
              onAddToAssistant={onAddToAssistant}
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

      {showFilterControl && (
        <Stack alignItems="center" height={HEADER_LINE_BOX} shrink={0}>
          <Filter
            name={column.key}
            rows={rows}
            field={field}
            timeZone={timeZone}
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
    // Keep the open-state highlight outside the button box so the header's spacing and reserved
    // width are unaffected.
    headerCellFilterButton: css({
      label: 'headerCellFilterButton',
      display: 'flex',
      alignItems: 'center',
      background: 'transparent',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      borderRadius: theme.spacing(0.25),
      '&[aria-expanded="true"]': {
        backgroundColor: theme.colors.action.hover,
        boxShadow: `0 0 0 ${theme.spacing(0.5)} ${theme.colors.action.hover}`,
      },
    }),
  })
);
