import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { type DataFrame } from '@grafana/data';

import { RenderMode, type TextMode } from '../panelcfg.gen';

import { MAX_RENDERED_ROWS, type RowWindow } from './renderContent';

export const PAGINATION_ROW_THRESHOLD = 100;

const PAGINATION_HEIGHT = 38;

const SMALL_PAGINATION_WIDTH = 750;

const ESTIMATED_ROW_HEIGHT = 24;

export function countRows(series: DataFrame[]): number {
  return series.reduce((total, frame) => total + (frame.fields.length > 0 ? frame.length : 0), 0);
}

export function clampPageSize(pageSize: number): number {
  return Math.max(1, Math.min(Math.floor(pageSize), MAX_RENDERED_ROWS));
}

export function fitPageSize(available: number, rowHeight: number): number {
  return clampPageSize(Math.floor(available / rowHeight));
}

interface Measured {
  rowHeight: number;
  available: number;
}

// Not scrollHeight: the element holding the blocks is stretched to the box, so it reports
// the box once a page fits inside it.
function measureContentHeight(element: HTMLElement): number {
  const blocks = element.firstElementChild;
  const first = blocks?.firstElementChild;
  const last = blocks?.lastElementChild;

  if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) {
    return 0;
  }

  return last.offsetTop + last.offsetHeight - first.offsetTop;
}

export interface PaginationOptions {
  content: string;
  mode: TextMode;
  renderMode?: RenderMode;
  pageSize?: number;
  series: DataFrame[];
  height: number;
  width: number;
  fitContent?: boolean;
}

export interface PaginationState {
  active: boolean;
  page: number;
  setPage: (page: number) => void;
  numPages: number;
  rowCount: number;
  rowWindow?: RowWindow;
  /** 1-based, inclusive. */
  rangeStart: number;
  rangeEnd: number;
  smallVersion: boolean;
  /** Attach to the box the blocks render into. A callback, because the editor mounts lazily. */
  contentRef: (element: HTMLElement | null) => void;
}

export function usePagination({
  content,
  mode,
  renderMode,
  pageSize,
  series,
  height,
  width,
  fitContent,
}: PaginationOptions): PaginationState {
  const [page, setPage] = useState(0);
  const [measured, setMeasured] = useState<Measured>();
  const [element, setElement] = useState<HTMLElement | null>(null);

  const rowCount = useMemo(() => countRows(series), [series]);
  // A fit-content panel grows to hold its content, so it has no height to page against.
  const paged = renderMode === RenderMode.PerRow && rowCount > PAGINATION_ROW_THRESHOLD && !fitContent;

  const configured = pageSize != null && pageSize > 0 ? clampPageSize(pageSize) : undefined;
  // The panel height stands in until a render reveals the box, which in the editor is the
  // preview pane rather than the panel.
  const resolvedPageSize =
    configured ??
    (measured
      ? fitPageSize(measured.available, measured.rowHeight)
      : fitPageSize(height - PAGINATION_HEIGHT, ESTIMATED_ROW_HEIGHT));

  const numPages = paged ? Math.ceil(rowCount / resolvedPageSize) : 0;
  const active = numPages > 1;
  // Clamped rather than reset, so a resize keeps the reader near where they were.
  const currentPage = Math.min(page, Math.max(0, numPages - 1));

  const rowsOnPage = Math.min(resolvedPageSize, rowCount - currentPage * resolvedPageSize);

  const fitToHeight = paged && configured === undefined;
  const measureKey = fitToHeight ? `${height}|${width}|${rowCount}|${mode}|${content}` : '';
  const measuredKey = useRef('');

  // Once per set of inputs, not per page size: re-measuring a page the last measurement
  // resized would let the page size oscillate.
  useLayoutEffect(() => {
    if (!fitToHeight || measuredKey.current === measureKey || !element) {
      return;
    }

    const available = element.clientHeight;
    const contentHeight = measureContentHeight(element);

    if (available <= 0 || rowsOnPage <= 0 || contentHeight <= 0) {
      return;
    }

    measuredKey.current = measureKey;
    setMeasured({ rowHeight: contentHeight / rowsOnPage, available });
  }, [fitToHeight, measureKey, rowsOnPage, element]);

  // Stable across renders: the editor memoises its preview on this.
  const rowWindow = useMemo(
    () => (active ? { start: currentPage * resolvedPageSize, count: resolvedPageSize } : undefined),
    [active, currentPage, resolvedPageSize]
  );

  const rangeStart = currentPage * resolvedPageSize + 1;

  return {
    active,
    page: currentPage,
    setPage,
    numPages,
    rowCount,
    rowWindow,
    rangeStart,
    rangeEnd: rangeStart + rowsOnPage - 1,
    smallVersion: width < SMALL_PAGINATION_WIDTH,
    contentRef: setElement,
  };
}
