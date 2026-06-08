import { useIsomorphicLayoutEffect } from '@react-hookz/web';
import { act, renderHook } from '@testing-library/react';
import { Subject, type Observable } from 'rxjs';

import { useObservable } from './useObservable';

jest.mock('@react-hookz/web', () => {
  const actual = jest.requireActual('@react-hookz/web');
  return {
    ...actual,
    useIsomorphicLayoutEffect: jest.fn(actual.useIsomorphicLayoutEffect),
  };
});

const useIsomorphicLayoutEffectMock = useIsomorphicLayoutEffect as jest.Mock;

beforeEach(() => {
  useIsomorphicLayoutEffectMock.mockClear();
});

const setUp = <T>(observable: Observable<T>, initialValue?: T) =>
  renderHook(() => useObservable(observable, initialValue as T));

it('should init to initial value provided', () => {
  const subject$ = new Subject<number>();
  const { result } = setUp(subject$, 123);

  expect(result.current).toBe(123);
});

it('should init to undefined if not initial value provided', () => {
  const subject$ = new Subject<number>();
  const { result } = setUp(subject$);

  expect(result.current).toBeUndefined();
});

it('should return latest value of observables', () => {
  const subject$ = new Subject<number>();
  const { result } = setUp(subject$, 123);

  act(() => {
    subject$.next(125);
  });
  expect(result.current).toBe(125);

  act(() => {
    subject$.next(300);
    subject$.next(400);
  });
  expect(result.current).toBe(400);
});

it('should use layout effect to subscribe synchronously', () => {
  const subject$ = new Subject<number>();

  expect(useIsomorphicLayoutEffectMock).toHaveBeenCalledTimes(0);

  setUp(subject$, 123);

  expect(useIsomorphicLayoutEffectMock).toHaveBeenCalledTimes(1);
});

it('should subscribe to observable only once', () => {
  const subject$ = new Subject<string>();
  const spy = jest.spyOn(subject$, 'subscribe');
  expect(spy).not.toHaveBeenCalled();

  setUp(subject$, 'init');

  expect(spy).toHaveBeenCalledTimes(1);

  act(() => {
    subject$.next('a');
  });

  act(() => {
    subject$.next('b');
  });

  expect(spy).toHaveBeenCalledTimes(1);
});

it('should return updated value when observable changes', () => {
  const subject$ = new Subject<string>();
  const { result } = setUp(subject$);
  expect(result.current).toBeUndefined();

  act(() => {
    subject$.next('foo');
  });
  expect(result.current).toBe('foo');

  act(() => {
    subject$.next('bar');
  });
  expect(result.current).toBe('bar');
});

it('should unsubscribe from observable', () => {
  const subject$ = new Subject<string>();
  const unsubscribeMock = jest.fn();
  subject$.subscribe = jest.fn().mockReturnValue({
    unsubscribe: unsubscribeMock,
  });

  const { unmount } = setUp(subject$);
  expect(unsubscribeMock).not.toHaveBeenCalled();

  act(() => {
    subject$.next('foo');
  });
  expect(unsubscribeMock).not.toHaveBeenCalled();

  act(() => {
    subject$.next('bar');
  });
  expect(unsubscribeMock).not.toHaveBeenCalled();

  unmount();
  expect(unsubscribeMock).toHaveBeenCalledTimes(1);
});
