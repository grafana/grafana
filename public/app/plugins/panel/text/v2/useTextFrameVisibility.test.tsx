import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';

import { useTextFrameVisibility } from './useTextFrameVisibility';

let intersect: IntersectionObserverCallback;
const observe = jest.fn();
const unobserve = jest.fn();
const disconnect = jest.fn();
const animationFrames = new Map<number, FrameRequestCallback>();

function nextAnimationFrame() {
  const callbacks = Array.from(animationFrames.values());
  animationFrames.clear();
  act(() => callbacks.forEach((callback) => callback(performance.now())));
}

function Panel({ enabled = true }: { enabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useTextFrameVisibility(host, enabled);
  return (
    <div ref={host} data-testid="host">
      {mounted && <iframe title="Live frame" />}
    </div>
  );
}

function visibility(visible: boolean, elements = screen.getAllByTestId('host')) {
  act(() =>
    intersect(
      elements.map((target) => ({ target, isIntersecting: visible }) as unknown as IntersectionObserverEntry),
      {} as IntersectionObserver
    )
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  animationFrames.clear();
  let nextId = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId++;
    animationFrames.set(id, callback);
    return id;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    animationFrames.delete(id);
  });
  jest.spyOn(window, 'IntersectionObserver').mockImplementation((callback) => {
    intersect = callback;
    return {
      observe,
      unobserve,
      disconnect,
      root: null,
      rootMargin: '1000px',
      scrollMargin: '1000px',
      thresholds: [0],
      takeRecords: () => [],
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useRealTimers();
});

it('shares one observer and mounts four nearby frames per animation frame', () => {
  render(
    <>
      {Array.from({ length: 10 }, (_, index) => (
        <Panel key={index} />
      ))}
    </>
  );
  expect(observe).toHaveBeenCalledTimes(10);
  expect(window.IntersectionObserver).toHaveBeenCalledTimes(1);
  expect(window.IntersectionObserver).toHaveBeenCalledWith(expect.any(Function), {
    rootMargin: '1000px',
    scrollMargin: '1000px',
  });
  expect(screen.queryAllByTitle('Live frame')).toHaveLength(0);
  visibility(true);
  act(() => jest.advanceTimersByTime(100));
  expect(screen.queryAllByTitle('Live frame')).toHaveLength(0);
  expect(animationFrames.size).toBe(1);
  nextAnimationFrame();
  expect(screen.getAllByTitle('Live frame')).toHaveLength(4);
  nextAnimationFrame();
  expect(screen.getAllByTitle('Live frame')).toHaveLength(8);
  nextAnimationFrame();
  expect(screen.getAllByTitle('Live frame')).toHaveLength(10);
  expect(animationFrames.size).toBe(0);
});

it('cancels queued mounts on departure and disposes only after a sustained absence', () => {
  const { unmount } = render(<Panel />);
  visibility(true);
  visibility(false);
  expect(animationFrames.size).toBe(0);
  nextAnimationFrame();
  expect(screen.queryByTitle('Live frame')).not.toBeInTheDocument();
  visibility(true);
  nextAnimationFrame();
  const frame = screen.getByTitle('Live frame');
  visibility(false);
  act(() => jest.advanceTimersByTime(4999));
  expect(frame).toBeInTheDocument();
  visibility(true);
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.getByTitle('Live frame')).toBe(frame);
  visibility(false);
  act(() => jest.advanceTimersByTime(5000));
  expect(frame).not.toBeInTheDocument();
  visibility(true);
  nextAnimationFrame();
  expect(screen.getByTitle('Live frame')).not.toBe(frame);
  unmount();
  expect(unobserve).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  expect(animationFrames.size).toBe(0);
});

it('keeps a focused frame alive until focus leaves', () => {
  render(<Panel />);
  visibility(true);
  nextAnimationFrame();
  const frame = screen.getByTitle('Live frame');
  frame.focus();
  visibility(false);
  act(() => jest.advanceTimersByTime(5000));
  expect(screen.getByTitle('Live frame')).toBe(frame);
  frame.blur();
  act(() => jest.advanceTimersByTime(5000));
  expect(frame).not.toBeInTheDocument();
});

it('renders immediately when disabled or unsupported, and cleans up pending mounts', () => {
  const view = render(<Panel />);
  visibility(true);
  view.rerender(<Panel enabled={false} />);
  expect(screen.getByTitle('Live frame')).toBeInTheDocument();
  expect(disconnect).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
  expect(animationFrames.size).toBe(0);
  view.unmount();
  const original = window.IntersectionObserver;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  try {
    render(<Panel />);
    expect(screen.getByTitle('Live frame')).toBeInTheDocument();
  } finally {
    Object.defineProperty(window, 'IntersectionObserver', { value: original });
  }
});
