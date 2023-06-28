import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useCallback, useState, CSSProperties } from 'react';
import { useTable, Column, TableOptions, Cell } from 'react-table';
import { FixedSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { Observable } from 'rxjs';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';
import { useStyles2, useTheme2 } from '@grafana/ui';
import { TableCell } from '@grafana/ui/src/components/Table/TableCell';
import { useTableStyles } from '@grafana/ui/src/components/Table/styles';
import { useCustomFlexLayout } from 'app/features/browse-dashboards/components/customFlexTableLayout';

import { useSearchKeyboardNavigation } from '../../hooks/useSearchKeyboardSelection';
import { QueryResponse } from '../../service';
import { SelectionChecker, SelectionToggle } from '../selection';

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
};

export type TableColumn = Column & {
  field?: Field;
};

const ROW_HEIGHT = 36; // pixels

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
  }: SearchResultsProps) => {
    const styles = useStyles2(getStyles);
    const columnStyles = useStyles2(getColumnStyles);
    const tableStyles = useTableStyles(useTheme2(), TableCellHeight.Sm);
    const infiniteLoaderRef = useRef<InfiniteLoader>(null);
    const [listEl, setListEl] = useState<FixedSizeList | null>(null);
    const highlightIndex = useSearchKeyboardNavigation(keyboardEvents, 0, response);

    const memoizedData = useMemo(() => {
      if (!response?.view?.dataFrame.fields.length) {
        return [];
      }

      // as we only use this to fake the length of our data set for react-table we need to make sure we always return an array
      // filled with values at each index otherwise we'll end up trying to call accessRow for null|undefined value in
      // https://github.com/tannerlinsley/react-table/blob/7be2fc9d8b5e223fc998af88865ae86a88792fdb/src/hooks/useTable.js#L585
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

    // React-table column definitions
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
        response.view?.length >= response.totalRows
      );
    }, [response, width, columnStyles, selection, selectionToggle, clearSelection, onTagSelected, onDatasourceChange]);

    const options: TableOptions<{}> = useMemo(
      () => ({
        columns: memoizedColumns,
        data: memoizedData,
      }),
      [memoizedColumns, memoizedData]
    );

    const { getTableProps, getTableBodyProps, headerGroups, rows, prepareRow } = useTable(options, useCustomFlexLayout);

    const handleLoadMore = useCallback(
      async (startIndex: number, endIndex: number) => {
        await response.loadMoreItems(startIndex, endIndex);

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
        prepareRow(row);

        const url = response.view.fields.url?.values[rowIndex];
        let className = styles.rowContainer;
        if (rowIndex === highlightIndex.y) {
          className += ' ' + styles.selectedRow;
        }

        return (
          <div {...row.getRowProps({ style })} className={className}>
            {row.cells.map((cell: Cell, index: number) => {
              return (
                <TableCell
                  key={index}
                  tableStyles={tableStyles}
                  cell={cell}
                  columnIndex={index}
                  columnCount={row.cells.length}
                  userProps={{ href: url, onClick: onClickItem }}
                />
              );
            })}
          </div>
        );
      },
      [rows, prepareRow, response.view.fields.url?.values, highlightIndex, styles, tableStyles, onClickItem]
    );

    if (!rows.length) {
      return <div className={styles.noData}>No data</div>;
    }

    return (
      <div {...getTableProps()} aria-label="Search results table" role="table">
        {headerGroups.map((headerGroup) => {
          const { key, ...headerGroupProps } = headerGroup.getHeaderGroupProps({
            style: { width },
          });

          return (
            <div key={key} {...headerGroupProps} className={styles.headerRow}>
              {headerGroup.headers.map((column) => {
                const { key, ...headerProps } = column.getHeaderProps();
                return (
                  <div key={key} {...headerProps} role="columnheader" className={styles.headerCell}>
                    {column.render('Header')}
                  </div>
                );
              })}
            </div>
          );
        })}

        <div {...getTableBodyProps()}>
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
  const rowHoverBg = theme.colors.emphasize(theme.colors.background.primary, 0.03);

  return {
    noData: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
    `,
    headerCell: css`
      align-items: center;
      display: flex;
      overflo: hidden;
      padding: ${theme.spacing(1)};
    `,
    headerRow: css`
      background-color: ${theme.colors.background.secondary};
      display: flex;
      gap: ${theme.spacing(1)};
      height: ${ROW_HEIGHT}px;
    `,
    selectedRow: css`
      background-color: ${rowHoverBg};
      box-shadow: inset 3px 0px ${theme.colors.primary.border};
    `,
    rowContainer: css`
      display: flex;
      gap: ${theme.spacing(1)};
      height: ${ROW_HEIGHT}px;
      label: row;
      &:hover {
        background-color: ${rowHoverBg};
      }

      &:not(:hover) div[role='cell'] {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  };
};

// CSS for columns from react table
const getColumnStyles = (theme: GrafanaTheme2) => {
  return {
    cell: css({
      padding: theme.spacing(1),
      overflow: 'hidden', // Required so flex children can do text-overflow: ellipsis
      display: 'flex',
      alignItems: 'center',
    }),
    nameCellStyle: css`
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
      white-space: nowrap;
    `,
    typeCell: css({
      gap: theme.spacing(0.5),
    }),
    typeIcon: css`
      fill: ${theme.colors.text.secondary};
    `,
    datasourceItem: css`
      span {
        &:hover {
          color: ${theme.colors.text.link};
        }
      }
    `,
    missingTitleText: css`
      color: ${theme.colors.text.disabled};
      font-style: italic;
    `,
    invalidDatasourceItem: css`
      color: ${theme.colors.error.main};
      text-decoration: line-through;
    `,
    locationContainer: css({
      display: 'flex',
      flexWrap: 'nowrap',
      gap: theme.spacing(1),
      overflow: 'hidden',
    }),
    locationItem: css`
      align-items: center;
      color: ${theme.colors.text.secondary};
      display: flex;
      flex-wrap: nowrap;
      gap: 4px;
      overflow: hidden;
    `,
    explainItem: css`
      cursor: pointer;
    `,
    tagList: css`
      justify-content: flex-start;
      flex-wrap: nowrap;
    `,
  };
};
