import React, { UIEventHandler, useCallback, useEffect, useMemo, useState } from 'react';
import { Row } from 'react-table';
import { VariableSizeList } from 'react-window';
import { Subscription, debounceTime } from 'rxjs';

import { DataFrame, DataHoverClearEvent, DataHoverEvent, EventBus, FieldType } from '@grafana/data';

import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';

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
  listRef: React.RefObject<VariableSizeList>;
  getItemSize: (index: number) => number;
  renderRow: (obj: { index: number; style: React.CSSProperties; rowHighlightIndex?: number }) => JSX.Element;
  handleScroll: UIEventHandler;
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
    listHeight,
    getItemSize,
    renderRow,
    listRef,
    handleScroll,
    enableSharedCrosshair = false,
  } = props;

  const [rowHighlightIndex, setRowHighlightIndex] = useState<number | undefined>(undefined);

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
          {({ index, style }) => renderRow({ index, style, rowHighlightIndex })}
        </VariableSizeList>
      </CustomScrollbar>
    </>
  );
};
