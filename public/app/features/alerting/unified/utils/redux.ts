import { type AsyncThunk, type SerializedError } from '@reduxjs/toolkit';

import { AppEvents } from '@grafana/data';
import { type FetchError, isFetchError } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';

import { LogMessages, logInfo } from '../Analytics';

import {
  type AsyncRequestMapSlice as AsyncRequestMapSliceBase,
  type AsyncRequestState as AsyncRequestStateBase,
  createAsyncMapSliceForTypePrefix,
  createAsyncSliceForTypePrefix,
  initialAsyncRequestState,
  isAsyncRequestMapSlicePartiallyDispatched,
  isAsyncRequestMapSlicePartiallyFulfilled,
  isAsyncRequestMapSlicePending,
  isAsyncRequestMapSliceSettled,
  isAsyncRequestStatePending,
} from './asyncRequestState';
import { isErrorLike } from './misc';

export type AsyncRequestMapSlice<T> = AsyncRequestMapSliceBase<T>;
export type AsyncRequestState<T> = AsyncRequestStateBase<T>;
export {
  initialAsyncRequestState,
  isAsyncRequestMapSlicePartiallyDispatched,
  isAsyncRequestMapSlicePartiallyFulfilled,
  isAsyncRequestMapSlicePending,
  isAsyncRequestMapSliceSettled,
  isAsyncRequestStatePending,
};

/*
 * createAsyncSlice creates a slice based on a given async action, exposing its state.
 * takes care to only use state of the latest invocation of the action if there are several in flight.
 */
export function createAsyncSlice<T, ThunkArg = void, ThunkApiConfig extends {} = {}>(
  name: string,
  asyncThunk: AsyncThunk<T, ThunkArg, ThunkApiConfig>
) {
  return createAsyncSliceForTypePrefix<T, ThunkArg>(name, asyncThunk.typePrefix);
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
  return createAsyncMapSliceForTypePrefix<T, ThunkArg>(name, asyncThunk.typePrefix, getEntityId);
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
  if (isErrorLike(e)) {
    return e.message;
  }
  // for some reason (upstream this code), sometimes we get an object without the message field neither in the e.data and nor in e.message
  // in this case we want to avoid String(e) printing [object][object]
  logInfo(LogMessages.unknownMessageFromError, { error: JSON.stringify(e) });
  return UNKNOW_ERROR;
}
