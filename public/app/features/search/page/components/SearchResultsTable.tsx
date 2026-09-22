import { css } from '@emotion/css';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useCallback, useState, type CSSProperties } from 'react';
import * as React from 'react';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { type Observable } from 'rxjs';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { usePanelPluginMetasMap } from '@grafana/runtime/internal';
import { TableCellHeight } from '@grafana/schema';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { useTableStyles, TableCell } from '@grafana/ui/internal';
import { getColumnFlexStyle, getFlexRowStyle } from 'app/features/browse-dashboards/components/customFlexTableLayout';

import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { type QueryResponse } from '../../service/types';
import { type SelectionChecker, type SelectionToggle } from '../selection';

import { generateColumns } from './columns';

export type SearchResultsProps = {
  response: QueryResponse;
  width: number;
  height: number;
  selection?: SelectionChecker;
  selectionToggle?: SelectionToggle;
  clearSelection: () => void;
  onTagSelected: (tag: string) => void;
  onDatasourceChange?: (datasource?: string) => void;
  onClickItem?: (event: React.MouseEvent<HTMLElement>) => void;
  keyboardEvents: Observable<React.KeyboardEvent>;
  trackingSource?: string;
};

const ROW_HEIGHT = 36; // pixels
const EMPTY_PANEL_PLUGIN_METAS = {};

export const SearchResultsTable = React.memo(
  ({
    response,
    width,
    height,
    selection,
    selectionToggle,
    clearSelection,
    onTagSelected,
    onDatasourceChange,
    onClickItem,
    keyboardEvents,
    trackingSource,
  }: SearchResultsProps) => {
    const styles = useStyles2(getStyles);
    const columnStyles = useStyles2(getColumnStyles);
    const tableStyles = useTableStyles(useTheme2(), TableCellHeight.Sm);
    const infiniteLoaderRef = useRef<InfiniteLoader>(null);
    const [listEl, setListEl] = useState<FixedSizeList | null>(null);
    const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, 0, response);
    const { value: panelPluginMetas = EMPTY_PANEL_PLUGIN_METAS } = usePanelPluginMetasMap();

    const memoizedData = useMemo(() => {
      if (!response?.view?.dataFrame.fields.length) {
        return [];
      }

      // Length placeholder: cells read values from the DataFrame field, not from this array.
      return Array(response.totalRows).fill(0);
    }, [response]);

    // Scroll to the top and clear loader cache when the query results change
    useEffect(() => {
      if (infiniteLoaderRef.current) {
        infiniteLoaderRef.current.resetloadMoreItemsCache();
      }
      if (listEl) {
        listEl.scrollTo(0);
      }
    }, [memoizedData, listEl]);

    const memoizedColumns = useMemo(() => {
      return generateColumns(
        response,
        width,
        selection,
        selectionToggle,
        clearSelection,
        columnStyles,
        onTagSelected,
        onDatasourceChange,
        response.view?.length >= response.totalRows,
        panelPluginMetas
      );
    }, [
      response,
      width,
      columnStyles,
      selection,
      selectionToggle,
      clearSelection,
      onTagSelected,
      onDatasourceChange,
      panelPluginMetas,
    ]);

    const table = useReactTable({
      columns: memoizedColumns,
      data: memoizedData,
      getCoreRowModel: getCoreRowModel(),
      // the table isn't paginated, so skip the state update TanStack Table queues whenever the data changes
      autoResetPageIndex: false,
    });
    const headerGroups = table.getHeaderGroups();
    const rows = table.getRowModel().rows;

    const handleLoadMore = useCallback(
      async (startIndex: number, endIndex: number) => {
        await response.loadMoreItems(endIndex);

        // After we load more items, select them if the "select all" checkbox
        // is selected
        const isAllSelected = selection?.('*', '*');
        if (!selectionToggle || !selection || !isAllSelected) {
          return;
        }

        for (let index = startIndex; index < response.view.length; index++) {
          const item = response.view.get(index);
          const itemIsSelected = selection(item.kind, item.uid);
          if (!itemIsSelected) {
            selectionToggle(item.kind, item.uid);
          }
        }
      },
      [response, selection, selectionToggle]
    );

    const RenderRow = useCallback(
      ({ index: rowIndex, style }: { index: number; style: CSSProperties }) => {
        const row = rows[rowIndex];

        const url = response.view.fields.url?.values[rowIndex];
        let className = styles.rowContainer;
        if (rowIndex === highlightIndex.y) {
          className += ' ' + styles.selectedRow;
        }

        const rowName = response.view.fields.name?.values[rowIndex];

        return (
          <div
            key={row.id}
            role="row"
            style={{ ...style, ...getFlexRowStyle() }}
            className={className}
            data-testid={rowName ? selectors.pages.Search.table.row(rowName) : undefined}
          >
            {row.getVisibleCells().map((cell, index: number) => {
              const href = onClickItem ? url : undefined;

              let userProps = {
                href,
                onClick: onClickItem,
              };

              if (cell.column.id === 'column-name' && href) {
                const item = response.view.get(rowIndex);
                const itemKind = item.kind;
                const parent = item.location || 'general';
                const parentType = parent === 'general' ? 'general' : 'folder';

                userProps.onClick = (evt: React.MouseEvent<HTMLElement>) => {
                  try {
                    reportInteraction('grafana_browse_dashboards_page_click_list_item', {
                      itemKind: itemKind,
                      parent: parentType,
                      source: trackingSource,
                    });
                  } catch (e) {
                    // ignore analytics errors
                  }
                  if (onClickItem) {
                    onClickItem(evt);
                  }
                };
              }

              return (
                <TableCell
                  key={index}
                  tableStyles={tableStyles}
                  cell={cell}
                  cellStyle={getColumnFlexStyle(cell.column)}
                  columnIndex={index}
                  columnCount={row.getVisibleCells().length}
                  userProps={userProps}
                  frame={response.view.dataFrame}
                />
              );
            })}
          </div>
        );
      },
      [rows, highlightIndex, styles, tableStyles, onClickItem, response.view, trackingSource]
    );

    if (!rows.length) {
      return (
        <div className={styles.noData}>
          <Trans i18nKey="search.search-results-table.no-data">No values</Trans>
        </div>
      );
    }

    return (
      <div
        aria-label={t('search.search-results-table.aria-label-search-results-table', 'Search results table')}
        role="table"
        data-testid={selectors.pages.Search.table.body}
      >
        {headerGroups.map((headerGroup) => {
          return (
            <div key={headerGroup.id} role="row" style={{ width, ...getFlexRowStyle() }} className={styles.headerRow}>
              {headerGroup.headers.map((header) => {
                return (
                  <div
                    key={header.id}
                    style={getColumnFlexStyle(header.column)}
                    role="columnheader"
                    className={styles.headerCell}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div role="rowgroup">
          <InfiniteLoader
            ref={infiniteLoaderRef}
            isItemLoaded={response.isItemLoaded}
            itemCount={rows.length}
            loadMoreItems={handleLoadMore}
          >
            {({ onItemsRendered, ref }) => (
              <FixedSizeList
                ref={(innerRef) => {
                  ref(innerRef);
                  setListEl(innerRef);
                }}
                onItemsRendered={onItemsRendered}
                height={height - ROW_HEIGHT}
                itemCount={rows.length}
                itemSize={tableStyles.rowHeight}
                width={width}
                style={{ overflow: 'hidden auto' }}
              >
                {RenderRow}
              </FixedSizeList>
            )}
          </InfiniteLoader>
        </div>
      </div>
    );
  }
);
SearchResultsTable.displayName = 'SearchResultsTable';

const getStyles = (theme: GrafanaTheme2) => {
  const rowHoverBg = theme.colors.action.hover;

  return {
    noData: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    }),
    headerCell: css({
      alignItems: 'center',
      display: 'flex',
      overflo: 'hidden',
      padding: theme.spacing(1),
    }),
    headerRow: css({
      backgroundColor: theme.colors.background.secondary,
      display: 'flex',
      gap: theme.spacing(1),
      height: `${ROW_HEIGHT}px`,
    }),
    selectedRow: css({
      backgroundColor: rowHoverBg,
      boxShadow: `inset 3px 0px ${theme.colors.primary.border}`,
    }),
    rowContainer: css({
      display: 'flex',
      gap: theme.spacing(1),
      height: `${ROW_HEIGHT}px`,
      label: 'row',
      '&:hover': {
        backgroundColor: rowHoverBg,
      },

      "&:not(:hover) div[role='cell']": {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
  };
};

// Column layout used by search result cells
const getColumnStyles = (theme: GrafanaTheme2) => {
  return {
    cell: css({
      padding: theme.spacing(1),
      overflow: 'hidden', // Required so flex children can do text-overflow: ellipsis
      display: 'flex',
      alignItems: 'center',
    }),
    nameCellStyle: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      userSelect: 'text',
      whiteSpace: 'nowrap',
    }),
    nameCell: css({
      // Gap between name and description tooltip
      gap: theme.spacing(0.5),
    }),
    typeCell: css({
      gap: theme.spacing(0.5),
    }),
    typeIcon: css({
      fill: theme.colors.text.secondary,
    }),
    datasourceItem: css({
      span: {
        '&:hover': {
          color: theme.colors.text.link,
        },
      },
    }),
    missingTitleText: css({
      color: theme.colors.text.disabled,
      fontStyle: 'italic',
    }),
    invalidDatasourceItem: css({
      color: theme.colors.error.main,
      textDecoration: 'line-through',
    }),
    locationContainer: css({
      display: 'flex',
      flexWrap: 'nowrap',
      gap: theme.spacing(1),
      // No overflow:hidden here — it would clip the focus ring (box-shadow) from child <a> elements.
      // The parent cell already clips the container width. Each locationItem handles its own truncation.
    }),
    locationItem: css({
      alignItems: 'center',
      color: theme.colors.text.secondary,
      display: 'flex',
      flexWrap: 'nowrap',
      gap: '4px',
      overflow: 'hidden',
    }),
    explainItem: css({
      cursor: 'pointer',
    }),
    tagList: css({
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      overflowX: 'auto',
    }),
  };
};
