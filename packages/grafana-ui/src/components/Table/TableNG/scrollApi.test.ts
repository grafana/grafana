import { renderHook } from '@testing-library/react';
import { createRef } from 'react';

import { type DataGridHandle } from '@grafana/react-data-grid';

import { scrollToDisplayedRow, useTableScrollHandle } from './scrollApi';
import { type TableNGApi } from './types';

function makeScrollElement(scrollHeightForRead: (read: number) => number) {
  const element = document.createElement('div');
  let scrollTop = 250;
  let reads = 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(element, 'clientHeight', { configurable: true, get: () => 100 });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeightForRead(++reads),
  });
  return {
    element,
    get scrollTop() {
      return scrollTop;
    },
    set scrollTop(value: number) {
      scrollTop = value;
    },
  };
}

describe('scrollToDisplayedRow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('pins the scroll container to the laid-out bottom when row height grows after the first scroll', () => {
    // First read is the estimate used before wrapped or nested rows finish layout.
    // The later read is the height once those rows have been measured.
    const scroller = makeScrollElement((read) => (read === 1 ? 180 : 450));
    const scrollToCell = jest.fn(() => {
      scroller.scrollTop = 80;
    });

    scrollToDisplayedRow({ element: scroller.element, scrollToCell }, 9, 'end');
    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 9 });
    expect(scroller.scrollTop).toBe(80);

    jest.runAllTimers();

    expect(scroller.scrollTop).toBe(350);
  });

  it('pins scrollToTop to the start of the scroll container', () => {
    const scroller = makeScrollElement(() => 450);
    const scrollToCell = jest.fn(() => {
      scroller.scrollTop = 20;
    });

    scrollToDisplayedRow({ element: scroller.element, scrollToCell }, 0, 'start');
    jest.runAllTimers();

    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 0 });
    expect(scroller.scrollTop).toBe(0);
  });

  it('does not move the scroll position when scrolling a row into view', () => {
    const scroller = makeScrollElement(() => 450);
    scroller.scrollTop = 40;
    const scrollToCell = jest.fn();

    scrollToDisplayedRow({ element: scroller.element, scrollToCell }, 2);
    jest.runAllTimers();

    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 2 });
    expect(scroller.scrollTop).toBe(40);
  });

  it('ignores a negative row index', () => {
    const scrollToCell = jest.fn();
    scrollToDisplayedRow({ element: document.createElement('div'), scrollToCell }, -1, 'end');
    expect(scrollToCell).not.toHaveBeenCalled();
  });
});

describe('useTableScrollHandle', () => {
  it('scrolls displayed indexes and ignores indexes outside that list', () => {
    const scrollToCell = jest.fn();
    const gridRef = {
      current: { element: document.createElement('div'), scrollToCell } as unknown as DataGridHandle,
    };
    const ref = createRef<TableNGApi>();

    renderHook(() => useTableScrollHandle(ref, gridRef, 3));

    ref.current?.scrollToRow(3);
    ref.current?.scrollToRow(-1);
    ref.current?.scrollToRow(1.5);
    expect(scrollToCell).not.toHaveBeenCalled();

    ref.current?.scrollToRow(2);
    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 2 });

    ref.current?.scrollToTop();
    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 0 });

    ref.current?.scrollToBottom();
    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 2 });
  });

  it('scrolls to the bottom of an updated displayed list', () => {
    const scrollToCell = jest.fn();
    const gridRef = {
      current: { element: document.createElement('div'), scrollToCell } as unknown as DataGridHandle,
    };
    const ref = createRef<TableNGApi>();

    const { rerender } = renderHook(({ count }) => useTableScrollHandle(ref, gridRef, count), {
      initialProps: { count: 2 },
    });
    rerender({ count: 5 });

    ref.current?.scrollToBottom();
    expect(scrollToCell).toHaveBeenCalledWith({ rowIdx: 4 });
  });
});
