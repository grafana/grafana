import { css, cx } from '@emotion/css';
import React, { CSSProperties, UIEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Row, TableState } from 'react-table';
import { VariableSizeList } from 'react-window';
import { Subscription, debounceTime } from 'rxjs';

import { DataFrame, DataHoverClearEvent, DataHoverEvent, EventBus, Field, FieldType, TimeRange } from '@grafana/data';
import { TableCellHeight } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';

import { ExpandedRow, getExpandedRowHeight } from './ExpandedRow';
import { TableCell } from './TableCell';
import { TableStyles } from './styles';
import { TableFilterActionCallback } from './types';
import { calculateAroundPointThreshold, hasTimeField, isPointTimeValAroundTableTimeVal } from './utils';

interface RowsListProps {
  data: DataFrame;
  rows: Row[];
  enableSharedCrosshair: boolean;
  headerHeight: number;
  rowHeight: number;
  itemCount: number;
  pageIndex: number;
  listHeight: number;
  width: number;
  cellHeight?: TableCellHeight;
  listRef: React.RefObject<VariableSizeList>;
  tableState: TableState;
  tableStyles: TableStyles;
  nestedDataField?: Field;
  prepareRow: (row: Row) => void;
  onRowHover?: (idx: number, frame: DataFrame) => void;
  onRowLeave?: () => void;
  onCellFilterAdded?: TableFilterActionCallback;
  timeRange?: TimeRange;
  footerPaginationEnabled: boolean;
  overrideRowHighlightIndex?: number;
  eventBus?: EventBus;
}

export const RowsList = (props: RowsListProps) => {
  const {
    data,
    rows,
    eventBus,
    headerHeight,
    footerPaginationEnabled,
    overrideRowHighlightIndex,
    rowHeight,
    itemCount,
    pageIndex,
    tableState,
    prepareRow,
    onRowHover,
    onRowLeave,
    onCellFilterAdded,
    width,
    cellHeight = TableCellHeight.Sm,
    timeRange,
    tableStyles,
    nestedDataField,
    listHeight,
    listRef,
    enableSharedCrosshair = false,
  } = props;

  const [rowHighlightIndex, setRowHighlightIndex] = useState<number | undefined>(undefined);

  const theme = useTheme2();

  const threshold = useMemo(() => {
    const timeField = data.fields.find((f) => f.type === FieldType.time);

    if (!timeField) {
      return 0;
    }

    return calculateAroundPointThreshold(timeField);
  }, [data]);

  const onDataHoverEvent = useCallback(
    (evt: DataHoverEvent) => {
      if (evt.payload.point?.time && evt.payload.rowIndex !== undefined) {
        const timeField = data.fields.find((f) => f.type === FieldType.time);
        const time = timeField!.values[evt.payload.rowIndex];

        // If the time value of the hovered point is around the time value of the
        // row with same index, highlight the row
        if (isPointTimeValAroundTableTimeVal(evt.payload.point.time, time, threshold)) {
          setRowHighlightIndex(evt.payload.rowIndex);
          return;
        }

        // If the time value of the hovered point is not around the time value of the
        // row with same index, try to find a row with same time value
        const matchedRowIndex = timeField!.values.findIndex((t) =>
          isPointTimeValAroundTableTimeVal(evt.payload.point.time, t, threshold)
        );

        if (matchedRowIndex !== -1) {
          setRowHighlightIndex(matchedRowIndex);
          return;
        }

        setRowHighlightIndex(undefined);
      }
    },
    [data.fields, threshold]
  );

  useEffect(() => {
    if (overrideRowHighlightIndex !== undefined) {
      setRowHighlightIndex(overrideRowHighlightIndex);
      return;
    }

    if (!eventBus || !enableSharedCrosshair || !hasTimeField(data) || footerPaginationEnabled) {
      return;
    }

    const subs = new Subscription();

    subs.add(
      eventBus
        .getStream(DataHoverEvent)
        .pipe(debounceTime(100))
        .subscribe({
          next: (evt) => {
            if (eventBus === evt.origin) {
              return;
            }

            onDataHoverEvent(evt);
          },
        })
    );

    subs.add(
      eventBus
        .getStream(DataHoverClearEvent)
        .pipe(debounceTime(100))
        .subscribe({
          next: (evt) => {
            if (eventBus === evt.origin) {
              return;
            }

            setRowHighlightIndex(undefined);
          },
        })
    );

    return () => {
      subs.unsubscribe();
    };
  }, [data, enableSharedCrosshair, eventBus, footerPaginationEnabled, onDataHoverEvent, overrideRowHighlightIndex]);

  let scrollTop: number | undefined = undefined;
  if (rowHighlightIndex !== undefined) {
    const firstMatchedRowIndex = rows.findIndex((row) => row.index === rowHighlightIndex);

    if (firstMatchedRowIndex !== -1) {
      scrollTop = headerHeight + (firstMatchedRowIndex - 1) * rowHeight;
    }
  }

  const rowIndexForPagination = useCallback(
    (index: number) => {
      return tableState.pageIndex * tableState.pageSize + index;
    },
    [tableState.pageIndex, tableState.pageSize]
  );

  const RenderRow = useCallback(
    ({ index, style, rowHighlightIndex }: { index: number; style: CSSProperties; rowHighlightIndex?: number }) => {
      const indexForPagination = rowIndexForPagination(index);
      const row = rows[indexForPagination];

      prepareRow(row);

      const expandedRowStyle = tableState.expanded[row.index] ? css({ '&:hover': { background: 'inherit' } }) : {};

      if (rowHighlightIndex !== undefined && row.index === rowHighlightIndex) {
        style = { ...style, backgroundColor: theme.components.table.rowHoverBackground };
      }

      return (
        <div
          {...row.getRowProps({ style })}
          className={cx(tableStyles.row, expandedRowStyle)}
          onMouseEnter={() => (onRowHover ? onRowHover(index, data) : null)}
          onMouseLeave={() => (onRowLeave ? onRowLeave() : null)}
        >
          {/*add the nested data to the DOM first to prevent a 1px border CSS issue on the last cell of the row*/}
          {nestedDataField && tableState.expanded[row.index] && (
            <ExpandedRow
              nestedData={nestedDataField}
              tableStyles={tableStyles}
              rowIndex={index}
              width={width}
              cellHeight={cellHeight}
            />
          )}
          {row.cells.map((cell: Cell, index: number) => (
            <TableCell
              key={index}
              tableStyles={tableStyles}
              cell={cell}
              onCellFilterAdded={onCellFilterAdded}
              columnIndex={index}
              columnCount={row.cells.length}
              timeRange={timeRange}
              frame={data}
            />
          ))}
        </div>
      );
    },
    [
      cellHeight,
      data,
      nestedDataField,
      onCellFilterAdded,
      onRowHover,
      onRowLeave,
      prepareRow,
      rowIndexForPagination,
      rows,
      tableState.expanded,
      tableStyles,
      theme.components.table.rowHoverBackground,
      timeRange,
      width,
    ]
  );

  const getItemSize = (index: number): number => {
    const indexForPagination = rowIndexForPagination(index);
    const row = rows[indexForPagination];
    if (tableState.expanded[row.index] && nestedDataField) {
      return getExpandedRowHeight(nestedDataField, index, tableStyles);
    }

    return tableStyles.rowHeight;
  };

  const handleScroll: UIEventHandler = (event) => {
    const { scrollTop } = event.currentTarget;

    if (listRef.current !== null) {
      listRef.current.scrollTo(scrollTop);
    }
  };

  return (
    <>
      <CustomScrollbar onScroll={handleScroll} hideHorizontalTrack={true} scrollTop={scrollTop}>
        <VariableSizeList
          // This component needs an unmount/remount when row height or page changes
          key={rowHeight + pageIndex}
          height={listHeight}
          itemCount={itemCount}
          itemSize={getItemSize}
          width={'100%'}
          ref={listRef}
          style={{ overflow: undefined }}
        >
          {({ index, style }) => RenderRow({ index, style, rowHighlightIndex })}
        </VariableSizeList>
      </CustomScrollbar>
    </>
  );
};
