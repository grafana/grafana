import { type SerializedError } from '@reduxjs/toolkit';

import { AppEvents } from '@grafana/data';
import { type FetchError, isFetchError } from '@grafana/runtime';
import { appEvents } from 'app/core/app_events';

import { LogMessages, logInfo } from '../Analytics';

import {
  type AsyncRequestMapSlice as AsyncRequestMapSliceBase,
  type AsyncRequestState as AsyncRequestStateBase,
  initialAsyncRequestState,
} from './asyncRequestState';
import { isErrorLike } from './misc';

export type AsyncRequestMapSlice<T> = AsyncRequestMapSliceBase<T>;
export type AsyncRequestState<T> = AsyncRequestStateBase<T>;
export { initialAsyncRequestState };

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

export function isAsyncRequestMapSliceSettled<T>(slice: AsyncRequestMapSlice<T>): boolean {
  return Object.values(slice).every(isAsyncRequestStateSettled);
}

function isAsyncRequestStateSettled<T>(state: AsyncRequestState<T>): boolean {
  return state.dispatched && !state.loading;
}

function isAsyncRequestStateFulfilled<T>(state: AsyncRequestState<T>): boolean {
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
