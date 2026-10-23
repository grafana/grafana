import { type SerializedError } from '@reduxjs/toolkit';

import { createAsyncMapSlice, createAsyncSlice } from './redux';

const typePrefix = 'test/request';

function pending(requestId: string, arg = 'entity') {
  return {
    type: `${typePrefix}/pending`,
    meta: { arg, requestId },
  };
}

function fulfilled<T>(requestId: string, payload: T, arg = 'entity') {
  return {
    type: `${typePrefix}/fulfilled`,
    payload,
    meta: { arg, requestId },
  };
}

function rejected(requestId: string, error: SerializedError, arg = 'entity') {
  return {
    type: `${typePrefix}/rejected`,
    error,
    meta: { arg, requestId },
  };
}

describe('async request state reducers', () => {
  it('tracks a fulfilled request', () => {
    const reducer = createAsyncSlice<string>('request', typePrefix).reducer;
    const loading = reducer(undefined, pending('request-1'));

    expect(loading).toEqual({
      result: undefined,
      loading: true,
      error: undefined,
      dispatched: true,
      requestId: 'request-1',
    });
    expect(reducer(loading, fulfilled('request-1', 'result'))).toEqual({
      ...loading,
      result: 'result',
      loading: false,
      error: undefined,
    });
  });

  it('tracks a rejected request', () => {
    const reducer = createAsyncSlice<string>('request', typePrefix).reducer;
    const loading = reducer(undefined, pending('request-1'));
    const error = { message: 'failed' };

    expect(reducer(loading, rejected('request-1', error))).toEqual({
      ...loading,
      loading: false,
      error,
    });
  });

  it('ignores a stale response', () => {
    const reducer = createAsyncSlice<string>('request', typePrefix).reducer;
    const firstRequest = reducer(undefined, pending('request-1'));
    const latestRequest = reducer(firstRequest, pending('request-2'));

    expect(reducer(latestRequest, fulfilled('request-1', 'stale'))).toEqual(latestRequest);
  });

  it('tracks requests independently in a map', () => {
    const reducer = createAsyncMapSlice<string, string>('requests', typePrefix, (arg) => arg).reducer;
    const firstPending = reducer(undefined, pending('request-1', 'first'));
    const bothPending = reducer(firstPending, pending('request-2', 'second'));
    const firstFulfilled = reducer(bothPending, fulfilled('request-1', 'result', 'first'));

    expect(firstFulfilled.first.result).toBe('result');
    expect(firstFulfilled.second.loading).toBe(true);
  });
});
