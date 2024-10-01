import { css, cx } from '@emotion/css';
import { CSSProperties, UIEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import { Cell, Row, TableState, HeaderGroup } from 'react-table';
import { VariableSizeList } from 'react-window';
import { Subscription, debounceTime } from 'rxjs';

import {
  DataFrame,
  DataHoverClearEvent,
  DataHoverEvent,
  Field,
  FieldType,
  TimeRange,
  hasTimeField,
} from '@grafana/data';
import { TableCellDisplayMode, TableCellHeight } from '@grafana/schema';

import { useTheme2 } from '../../themes';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';
import { usePanelContext } from '../PanelChrome';

import { ExpandedRow, getExpandedRowHeight } from './ExpandedRow';
import { TableCell } from './TableCell';
import { TableStyles } from './styles';
import { CellColors, TableFieldOptions, TableFilterActionCallback } from './types';
import {
  calculateAroundPointThreshold,
  getCellColors,
  isPointTimeValAroundTableTimeVal,
  guessTextBoundingBox,
} from './utils';

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
  onCellFilterAdded?: TableFilterActionCallback;
  timeRange?: TimeRange;
  footerPaginationEnabled: boolean;
  initialRowIndex?: number;
  headerGroups: HeaderGroup[];
  longestField?: Field;
}

export const RowsList = (props: RowsListProps) => {
  const {
    data,
    rows,
    headerHeight,
    footerPaginationEnabled,
    rowHeight,
    itemCount,
    pageIndex,
    tableState,
    prepareRow,
    onCellFilterAdded,
    width,
    cellHeight = TableCellHeight.Sm,
    timeRange,
    tableStyles,
    nestedDataField,
    listHeight,
    listRef,
    enableSharedCrosshair = false,
    initialRowIndex = undefined,
    headerGroups,
    longestField,
  } = props;

  const [rowHighlightIndex, setRowHighlightIndex] = useState<number | undefined>(initialRowIndex);
  if (initialRowIndex === undefined && rowHighlightIndex !== undefined) {
    setRowHighlightIndex(undefined);
  }

  const theme = useTheme2();
  const panelContext = usePanelContext();

  // Create off-screen canvas for measuring rows for virtualized rendering
  // This line is like this because Jest doesn't have OffscreenCanvas mocked
  // nor is it a part of the jest-canvas-mock package
  let osContext = null;
  if (window.OffscreenCanvas !== undefined) {
    // The canvas size is defined arbitrarily
    // As we never actually visualize rendered content
    // from the offscreen canvas, only perform text measurements
    osContext = new OffscreenCanvas(256, 1024).getContext('2d');
  }

  // Set font property using theme info
  // This will make text measurement accurate
  if (osContext !== undefined && osContext !== null) {
    osContext.font = `${theme.typography.fontSize}px ${theme.typography.body.fontFamily}`;
  }

  const threshold = useMemo(() => {
    const timeField = data.fields.find((f) => f.type === FieldType.time);

    if (!timeField) {
      return 0;
    }

    return calculateAroundPointThreshold(timeField);
  }, [data]);

  const onRowHover = useCallback(
    (idx: number, frame: DataFrame) => {
      if (!panelContext || !enableSharedCrosshair || !hasTimeField(frame)) {
        return;
      }

      const timeField: Field = frame!.fields.find((f) => f.type === FieldType.time)!;

      panelContext.eventBus.publish(
        new DataHoverEvent({
          point: {
            time: timeField.values[idx],
          },
        })
      );
    },
    [enableSharedCrosshair, panelContext]
  );

  const onRowLeave = useCallback(() => {
    if (!panelContext || !enableSharedCrosshair) {
      return;
    }

    panelContext.eventBus.publish(new DataHoverClearEvent());
  }, [enableSharedCrosshair, panelContext]);

  const onDataHoverEvent = useCallback(
    (evt: DataHoverEvent) => {
      if (evt.payload.point?.time && evt.payload.rowIndex !== undefined) {
        const timeField = data.fields.find((f) => f.type === FieldType.time);
        const time = timeField!.values[evt.payload.rowIndex];
        const pointTime = evt.payload.point.time;

        // If the time value of the hovered point is around the time value of the
        // row with same index, highlight the row
        if (isPointTimeValAroundTableTimeVal(pointTime, time, threshold)) {
          setRowHighlightIndex(evt.payload.rowIndex);
          return;
        }

        // If the time value of the hovered point is not around the time value of the
        // row with same index, try to find a row with same time value
        const matchedRowIndex = timeField!.values.findIndex((t) =>
          isPointTimeValAroundTableTimeVal(pointTime, t, threshold)
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
    if (!panelContext || !enableSharedCrosshair || !hasTimeField(data) || footerPaginationEnabled) {
      return;
    }

    const subs = new Subscription();

    subs.add(
      panelContext.eventBus
        .getStream(DataHoverEvent)
        .pipe(debounceTime(250))
        .subscribe({
          next: (evt) => {
            if (panelContext.eventBus === evt.origin) {
              return;
            }

            onDataHoverEvent(evt);
          },
        })
    );

    subs.add(
      panelContext.eventBus
        .getStream(DataHoverClearEvent)
        .pipe(debounceTime(250))
        .subscribe({
          next: (evt) => {
            if (panelContext.eventBus === evt.origin) {
              return;
            }

            setRowHighlightIndex(undefined);
          },
        })
    );

    return () => {
      subs.unsubscribe();
    };
  }, [data, enableSharedCrosshair, footerPaginationEnabled, onDataHoverEvent, panelContext]);

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

  let rowBg: Function | undefined = undefined;
  let textWrapField: Field | undefined = undefined;
  for (const field of data.fields) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const fieldOptions = field.config.custom as TableFieldOptions;
    const cellOptionsExist = fieldOptions !== undefined && fieldOptions.cellOptions !== undefined;

    if (
      cellOptionsExist &&
      fieldOptions.cellOptions.type === TableCellDisplayMode.ColorBackground &&
      fieldOptions.cellOptions.applyToRow
    ) {
      rowBg = (rowIndex: number): CellColors => {
        const display = field.display!(field.values.get(rowIndex));
        const colors = getCellColors(tableStyles, fieldOptions.cellOptions, display);
        return colors;
      };
    }

    if (
      cellOptionsExist &&
      (fieldOptions.cellOptions.type === TableCellDisplayMode.Auto ||
        fieldOptions.cellOptions.type === TableCellDisplayMode.ColorBackground ||
        fieldOptions.cellOptions.type === TableCellDisplayMode.ColorText) &&
      fieldOptions.cellOptions.wrapText
    ) {
      textWrapField = field;
    } else if (longestField !== undefined) {
      textWrapField = longestField;
    }
  }

  const RenderRow = useCallback(
    ({ index, style, rowHighlightIndex }: { index: number; style: CSSProperties; rowHighlightIndex?: number }) => {
      const indexForPagination = rowIndexForPagination(index);
      const row = rows[indexForPagination];
      let additionalProps: React.HTMLAttributes<HTMLDivElement> = {};
      prepareRow(row);

      const expandedRowStyle = tableState.expanded[row.id] ? css({ '&:hover': { background: 'inherit' } }) : {};
      const rowExpanded = nestedDataField && tableState.expanded[row.id];

      if (rowHighlightIndex !== undefined && row.index === rowHighlightIndex) {
        style = { ...style, backgroundColor: theme.components.table.rowSelected };
        additionalProps = {
          'aria-selected': 'true',
        };
      }

      // Color rows if enabled
      if (rowBg) {
        const { bgColor, textColor } = rowBg(row.index);
        style.background = bgColor;
        style.color = textColor;
      }

      // If there's a text wrapping field we set the height of it here
      if (textWrapField) {
        const visibleFields = data.fields.filter((field) => !Boolean(field.config.custom?.hidden));
        const seriesIndex = visibleFields.findIndex((field) => field.name === textWrapField.name);
        const pxLineHeight = theme.typography.body.lineHeight * theme.typography.fontSize;
        const bbox = guessTextBoundingBox(
          textWrapField.values[index],
          headerGroups[0].headers[seriesIndex],
          osContext,
          pxLineHeight,
          tableStyles.rowHeight
        );
        style.height = bbox.height;
      }
      const { key, ...rowProps } = row.getRowProps({ style, ...additionalProps });

      return (
        <div
          key={key}
          {...rowProps}
          className={cx(tableStyles.row, expandedRowStyle)}
          onMouseEnter={() => onRowHover(index, data)}
          onMouseLeave={onRowLeave}
        >
          {/*add the nested data to the DOM first to prevent a 1px border CSS issue on the last cell of the row*/}
          {rowExpanded && (
            <ExpandedRow
              nestedData={nestedDataField}
              tableStyles={tableStyles}
              // Using `row.index` ensures that we pick the correct row from the original data frame even when rows in
              // the table are sorted, since `row.index` does not change when sorting.
              rowIndex={row.index}
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
              rowStyled={rowBg !== undefined}
              rowExpanded={rowExpanded}
              textWrapped={textWrapField !== undefined}
              height={Number(style.height)}
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
      textWrapField,
      theme.components.table.rowSelected,
      theme.typography.fontSize,
      theme.typography.body.lineHeight,
      timeRange,
      width,
      rowBg,
      headerGroups,
      osContext,
    ]
  );

  const getItemSize = (index: number): number => {
    const indexForPagination = rowIndexForPagination(index);
    const row = rows[indexForPagination];

    if (tableState.expanded[row.id] && nestedDataField) {
      return getExpandedRowHeight(nestedDataField, row.index, tableStyles);
    }

    if (textWrapField) {
      const visibleFields = data.fields.filter((field) => !Boolean(field.config.custom?.hidden));
      const seriesIndex = visibleFields.findIndex((field) => field.name === textWrapField.name);
      const pxLineHeight = theme.typography.fontSize * theme.typography.body.lineHeight;
      return guessTextBoundingBox(
        textWrapField.values[index],
        headerGroups[0].headers[seriesIndex],
        osContext,
        pxLineHeight,
        tableStyles.rowHeight
      ).height;
    }

    return tableStyles.rowHeight;
  };

  const handleScroll: UIEventHandler = (event) => {
    const { scrollTop } = event.currentTarget;

    if (listRef.current !== null) {
      listRef.current.scrollTo(scrollTop);
    }
  };

  // Key the virtualizer for expanded rows
  const expandedKey = Object.keys(tableState.expanded).join('|');

  return (
    <>
      <CustomScrollbar onScroll={handleScroll} hideHorizontalTrack={true} scrollTop={scrollTop}>
        <VariableSizeList
          // This component needs an unmount/remount when row height, page changes, or expanded rows change
          key={`${rowHeight}${pageIndex}${expandedKey}`}
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
