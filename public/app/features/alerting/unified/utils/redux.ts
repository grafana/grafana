import { AsyncThunk, createSlice, Draft, isAsyncThunkAction, PayloadAction, SerializedError } from '@reduxjs/toolkit';

import { AppEvents } from '@grafana/data';
import { FetchError, isFetchError } from '@grafana/runtime';
import { appEvents } from 'app/core/core';

import { logInfo, LogMessages } from '../Analytics';

export interface AsyncRequestState<T> {
  result?: T;
  loading: boolean;
  error?: SerializedError;
  dispatched: boolean;
  requestId?: string;
}

export const initialAsyncRequestState: Pick<
  AsyncRequestState<undefined>,
  'loading' | 'dispatched' | 'result' | 'error'
> = Object.freeze({
  loading: false,
  result: undefined,
  error: undefined,
  dispatched: false,
});

export type AsyncRequestMapSlice<T> = Record<string, AsyncRequestState<T>>;

export type AsyncRequestAction<T> = PayloadAction<Draft<T>, string, any, any>;

function requestStateReducer<T, ThunkArg = void, ThunkApiConfig extends {} = {}>(
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>,
  state: Draft<AsyncRequestState<T>> = initialAsyncRequestState,
  action: AsyncRequestAction<T>
): Draft<AsyncRequestState<T>> {
  if (asyncThunk.pending.match(action)) {
    return {
      result: state.result,
      loading: true,
      error: state.error,
      dispatched: true,
      requestId: action.meta.requestId,
    };
  } else if (asyncThunk.fulfilled.match(action)) {
    if (state.requestId === undefined || state.requestId === action.meta.requestId) {
      return {
        ...state,
        result: action.payload,
        loading: false,
        error: undefined,
      };
    }
  } else if (asyncThunk.rejected.match(action)) {
    if (state.requestId === action.meta.requestId) {
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    }
  }
  return state;
}

/*
 * createAsyncSlice creates a slice based on a given async action, exposing its state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice<T, ThunkArg = void, ThunkApiConfig extends {} = {}>(
  name: string,
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>
) {
  return createSlice({
    name,
    initialState: initialAsyncRequestState as AsyncRequestState<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) =>
        requestStateReducer(asyncThunk, state, action as unknown as AsyncRequestAction<T>)
      ),
  });
}

/*
 * createAsyncMapSlice creates a slice based on a given async action exposing a map of request states.
 * separate requests are uniquely indentified by result of provided getEntityId function
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncMapSlice<T, ThunkArg = void, ThunkApiConfig extends {} = {}>(
  name: string,
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>,
  getEntityId: (arg: ThunkArg) => string
) {
  return createSlice({
    name,
    initialState: {} as AsyncRequestMapSlice<T>,
    reducers: {},
    extraReducers: (builder) =>
      builder.addDefaultCase((state, action) => {
        if (isAsyncThunkAction(asyncThunk)(action)) {
          const asyncAction = action as unknown as AsyncRequestAction<T>;
          const entityId = getEntityId(asyncAction.meta.arg);
          return {
            ...state,
            [entityId]: requestStateReducer(asyncThunk, state[entityId], asyncAction),
          };
        }
        return state;
      }),
  });
}

// rethrow promise error in redux serialized format
export function withSerializedError<T>(p: Promise<T>): Promise<T> {
  return p.catch((e) => {
    const err: SerializedError = {
      message: messageFromError(e),
      code: e.statusCode,
    };
    throw err;
  });
}

export function withAppEvents<T>(
  p: Promise<T>,
  options: { successMessage?: string; errorMessage?: string }
): Promise<T> {
  return p
    .then((v) => {
      if (options.successMessage) {
        appEvents.emit(AppEvents.alertSuccess, [options.successMessage]);
      }
      return v;
    })
    .catch((e) => {
      const msg = messageFromError(e);
      appEvents.emit(AppEvents.alertError, [`${options.errorMessage ?? 'Error'}: ${msg}`]);
      throw e;
    });
}

export const UNKNOW_ERROR = 'Unknown Error';
export function messageFromError(e: Error | FetchError | SerializedError): string {
  if (isFetchError(e)) {
    if (e.data?.message) {
      let msg = e.data?.message;
      if (typeof e.data?.error === 'string') {
        msg += `; ${e.data.error}`;
      }
      return msg;
    } else if (Array.isArray(e.data) && e.data.length && e.data[0]?.message) {
      return e.data
        .map((d) => d?.message)
        .filter((m) => !!m)
        .join(' ');
    } else if (e.statusText) {
      return e.statusText;
    }
  }
  // message in e object, return message
  const errorMessage = (e as Error)?.message;
  if (errorMessage) {
    return errorMessage;
  }
  // for some reason (upstream this code), sometimes we get an object without the message field neither in the e.data and nor in e.message
  // in this case we want to avoid String(e) printing [object][object]
  logInfo(LogMessages.unknownMessageFromError, { error: JSON.stringify(e) });
  return UNKNOW_ERROR;
}

export function isAsyncRequestMapSliceSettled<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).every(isAsyncRequestStateSettled);
}

export function isAsyncRequestStateSettled<T>(state: AsyncRequestState<T>): boolean {
  return state.dispatched && !state.loading;
}

export function isAsyncRequestMapSliceFulfilled<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).every(isAsyncRequestStateFulfilled);
}

export function isAsyncRequestStateFulfilled<T>(state: AsyncRequestState<T>): boolean {
  return state.dispatched && !state.loading && !state.error;
}

export function isAsyncRequestMapSlicePending<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).some(isAsyncRequestStatePending);
}

export function isAsyncRequestMapSlicePartiallyDispatched<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).some((state) => state.dispatched);
}

export function isAsyncRequestMapSlicePartiallyFulfilled<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).some(isAsyncRequestStateFulfilled);
}

export function isAsyncRequestStatePending<T>(state?: AsyncRequestState<T>): boolean {
  if (!state) {
    return false;
  }

  return state.dispatched && state.loading;
}
