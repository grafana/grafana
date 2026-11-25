import { act, renderHook } from '@testing-library/react';

import { useTextPanelHeight } from './useTextPanelHeight';

it('ignores width-only changes, reports height changes, and disconnects replaced targets', () => {
  const callbacks: ResizeObserverCallback[] = [];
  const observers: ResizeObserver[] = [];
  const constructor = jest.spyOn(window, 'ResizeObserver').mockImplementation((callback) => {
    const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
    callbacks.push(callback);
    observers.push(observer);
    return observer;
  });
  const measure = (width: number, height: number, index = 0) => {
    act(() => callbacks[index]([{ contentRect: { width, height } } as ResizeObserverEntry], observers[index]));
  };
  try {
    const { result, unmount } = renderHook(useTextPanelHeight);
    const first = document.createElement('div');
    act(() => result.current[0](first));
    expect(observers[0].observe).toHaveBeenCalledWith(first);
    measure(200, 100);
    expect(result.current[1]).toBe(100);
    const previous = result.current;
    measure(250, 100);
    measure(300, 100);
    expect(result.current).toBe(previous);
    measure(300, 80.5);
    expect(result.current[1]).toBe(80.5);

    const second = document.createElement('div');
    act(() => result.current[0](second));
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    expect(observers[1].observe).toHaveBeenCalledWith(second);
    measure(400, 120, 1);
    measure(300, 999, 0);
    expect(result.current[1]).toBe(120);
    measure(400, 0, 1);
    expect(result.current[1]).toBe(0);
    unmount();
    expect(observers[1].disconnect).toHaveBeenCalledTimes(1);
  } finally {
    constructor.mockRestore();
  }
});
