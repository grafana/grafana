import { autoUpdate } from '@floating-ui/react';

it('coalesces floating-element resize updates outside observer delivery and cancels them on cleanup', () => {
  const originalObserver = global.ResizeObserver;
  let notify: ResizeObserverCallback;
  const disconnect = jest.fn();
  const unobserve = jest.fn();
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      notify = callback;
    }
    observe() {}
    unobserve = unobserve;
    disconnect = disconnect;
  };
  jest.useFakeTimers();
  const reference = document.createElement('button');
  const floating = document.createElement('div');
  document.body.append(reference, floating);
  const update = jest.fn();
  const cleanup = autoUpdate(reference, floating, update, {
    ancestorResize: false,
    ancestorScroll: false,
    layoutShift: false,
  });
  const resize = (target: Element) => {
    const size = [{ inlineSize: 100, blockSize: 20 }];
    notify(
      [
        {
          target,
          contentBoxSize: size,
          borderBoxSize: size,
          devicePixelContentBoxSize: size,
          contentRect: reference.getBoundingClientRect(),
        },
      ],
      {} as ResizeObserver
    );
  };
  try {
    expect(update).toHaveBeenCalledTimes(1);
    resize(reference);
    resize(floating);
    expect(update).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(16);
    expect(update).toHaveBeenCalledTimes(2);
    expect(unobserve).toHaveBeenCalledWith(floating);
    resize(floating);
    cleanup();
    jest.runOnlyPendingTimers();
    expect(update).toHaveBeenCalledTimes(2);
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    cleanup();
    reference.remove();
    floating.remove();
    jest.useRealTimers();
    global.ResizeObserver = originalObserver;
  }
});
