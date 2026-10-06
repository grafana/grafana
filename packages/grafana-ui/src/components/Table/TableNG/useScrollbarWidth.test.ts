import { act, renderHook } from '@testing-library/react';

import { type DataGridHandle } from '@grafana/react-data-grid';

import { useScrollbarWidth } from './hooks';

describe('useScrollbarWidth cleanup', () => {
  const observe = jest.fn();
  const disconnect = jest.fn();
  let notifyResize: () => void;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'ResizeObserver').mockImplementation((callback) => {
      const observer = { observe, disconnect, unobserve: jest.fn() };
      notifyResize = () => callback([], observer);
      return observer;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  function setup() {
    const element = document.createElement('div');
    const readClientWidth = jest.fn(() => 485);
    Object.defineProperties(element, {
      offsetWidth: { value: 500 },
      clientWidth: { get: readClientWidth },
    });
    const ref = { current: { element } as DataGridHandle };
    return {
      ...renderHook(({ height }) => useScrollbarWidth(ref, height), { initialProps: { height: 300 } }),
      readClientWidth,
      element,
    };
  }

  it('keeps the observer across rerenders and preserves the initial debounce', () => {
    const { result, rerender, element, unmount } = setup();
    expect(observe).toHaveBeenCalledWith(element);
    act(() => jest.advanceTimersByTime(149));
    expect(result.current).toBe(0);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(15);

    rerender({ height: 300 });
    expect(observe).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
    unmount();
  });

  it('cancels a pending resize measurement when unmounted', () => {
    const { result, readClientWidth, unmount } = setup();
    act(() => jest.advanceTimersByTime(150));
    expect(result.current).toBe(15);
    readClientWidth.mockClear();

    act(() => notifyResize());
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(150));
    expect(readClientWidth).not.toHaveBeenCalled();
  });

  it('cancels the previous measurement when height changes', () => {
    const { result, rerender, readClientWidth, unmount } = setup();
    act(() => jest.advanceTimersByTime(100));
    rerender({ height: 400 });
    expect(disconnect).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(50));
    expect(readClientWidth).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe(15);
    expect(readClientWidth).toHaveBeenCalledTimes(1);
    unmount();
  });
});
