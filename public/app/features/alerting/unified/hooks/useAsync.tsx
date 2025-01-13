/**
 * Copied from https://github.com/react-hookz/web/blob/579a445fcc9f4f4bb5b9d5e670b2e57448b4ee50/src/useAsync/index.ts
 */
import { useMemo, useRef, useState } from 'react';

import { stringifyErrorLike } from '../utils/misc';

export type AsyncStatus = 'loading' | 'success' | 'error' | 'not-executed';

export type AsyncState<Result> =
  | AsyncStateUninitialized<Result>
  | AsyncStateFulfilled<Result>
  | AsyncStateWithError<Result>
  | AsyncStateLoading<Result>;

export type AsyncStateWithError<Result> = {
  status: 'error';
  error: Error;
  result: Result;
};

export type AsyncStateFulfilled<Result> = {
  status: 'success';
  error: undefined;
  result: Result;
};

export type AsyncStateUninitialized<Result> = {
  status: 'not-executed';
  error: undefined;
  result: Result;
};

export type AsyncStateLoading<Result> = {
  status: 'loading';
  error: Error | undefined;
  result: Result;
};

export type UseAsyncActions<Result, Args extends unknown[] = unknown[]> = {
  /**
   * Reset state to initial.
   */
  reset: () => void;
  /**
   * Execute the async function manually.
   */
  execute: (...args: Args) => Promise<Result>;
};

export type UseAsyncMeta<Result, Args extends unknown[] = unknown[]> = {
  /**
   * Latest promise returned from the async function.
   */
  promise: Promise<Result> | undefined;
  /**
   * List of arguments applied to the latest async function invocation.
   */
  lastArgs: Args | undefined;
};

export function useAsync<Result, Args extends unknown[] = unknown[]>(
  asyncFn: (...params: Args) => Promise<Result>,
  initialValue: Result
): [UseAsyncActions<Result, Args>, AsyncState<Result>, UseAsyncMeta<Result, Args>];
export function useAsync<Result, Args extends unknown[] = unknown[]>(
  asyncFn: (...params: Args) => Promise<Result>,
  initialValue?: Result
): [UseAsyncActions<Result, Args>, AsyncState<Result | undefined>, UseAsyncMeta<Result, Args>];

/**
 * Tracks the result and errors of the provided async function and provides handles to control its execution.
 *
 * @param asyncFn Function that returns a promise.
 * @param initialValue Value that will be set on initialisation before the async function is
 * executed.
 */
export function useAsync<Result, Args extends unknown[] = unknown[]>(
  asyncFn: (...params: Args) => Promise<Result>,
  initialValue?: Result
): [UseAsyncActions<Result, Args>, AsyncState<Result | undefined>, UseAsyncMeta<Result, Args>] {
  const [state, setState] = useState<AsyncState<Result | undefined>>({
    status: 'not-executed',
    error: undefined,
    result: initialValue,
  });
  const promiseRef = useRef<Promise<Result>>();
  const argsRef = useRef<Args>();

  const methods = useSyncedRef({
    execute(...params: Args) {
      argsRef.current = params;
      const promise = asyncFn(...params);
      promiseRef.current = promise;

      setState((s) => ({ ...s, status: 'loading' }));

      promise.then(
        (result) => {
          // We dont want to handle result/error of non-latest function
          // this approach helps to avoid race conditions

          if (promise === promiseRef.current) {
            setState((s) => ({ ...s, status: 'success', error: undefined, result }));
          }
        },
        (error: Error) => {
          // We dont want to handle result/error of non-latest function
          // this approach helps to avoid race conditions
          if (promise === promiseRef.current) {
            setState((s) => ({ ...s, status: 'error', error }));
          }
        }
      );

      return promise;
    },
    reset() {
      setState({
        status: 'not-executed',
        error: undefined,
        result: initialValue,
      });
      promiseRef.current = undefined;
      argsRef.current = undefined;
    },
  });

  return [
    useMemo(
      () => ({
        reset() {
          methods.current.reset();
        },
        execute: (...params: Args) => methods.current.execute(...params),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    ),
    state,
    { promise: promiseRef.current, lastArgs: argsRef.current },
  ];
}

/**
 * Like `useRef`, but it returns immutable ref that contains actual value.
 *
 * @param value
 */
function useSyncedRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value);

  ref.current = value;

  return useMemo(
    () =>
      Object.freeze({
        get current() {
          return ref.current;
        },
      }),
    []
  );
}

// --- utility functions to help with request state assertions ---

export function isError<T>(state: AsyncState<unknown>): state is AsyncStateWithError<T> {
  return state.status === 'error';
}

export function isSuccess<T>(state: AsyncState<T>): state is AsyncStateFulfilled<T> {
  return state.status === 'success';
}

export function isUninitialized<T>(state: AsyncState<T>): state is AsyncStateUninitialized<T> {
  return state.status === 'not-executed';
}

export function isLoading<T>(state: AsyncState<T>): state is AsyncStateLoading<T> {
  return state.status === 'loading';
}

export function anyOfRequestState(...states: Array<AsyncState<unknown>>) {
  return {
    uninitialized: states.every(isUninitialized),
    loading: states.some(isLoading),
    error: states.find(isError)?.error,
    success: states.some(isSuccess),
  };
}

/**
 * This is only used for testing and serializing the async state
 */
export function SerializeState<T>({ state }: { state: AsyncState<T> }) {
  return (
    <>
      {isUninitialized(state) && 'uninitialized'}
      {isLoading(state) && 'loading'}
      {isSuccess(state) && 'success'}
      {isSuccess(state) && `result: ${JSON.stringify(state.result, null, 2)}`}
      {isError(state) && `error: ${stringifyErrorLike(state.error)}`}
    </>
  );
}
