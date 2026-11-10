import { isFetchError } from '@grafana/runtime';

import { schedulePermissionLookup } from './permissionLookupQueue';

const REQUEST_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function shouldRetry(result: unknown): boolean {
  if (typeof result !== 'object' || result === null || !('error' in result) || result.error === undefined) {
    return false;
  }
  const error = result.error;
  return (
    !isFetchError(error) || error.status < 400 || error.status >= 500 || error.status === 408 || error.status === 429
  );
}

function waitForRetry(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const complete = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', complete);
      resolve();
    };
    const timer = setTimeout(complete, RETRY_DELAY_MS);
    if (signal.aborted) {
      complete();
    } else {
      signal.addEventListener('abort', complete, { once: true });
    }
  });
}

/** Keeps RTK Query pending through retries, scheduling each attempt separately. */
export async function requestPermissionQuery<T>(request: () => Promise<T>, signal: AbortSignal): Promise<T> {
  let result = await schedulePermissionLookup(request, signal);
  for (let attempt = 1; attempt < REQUEST_ATTEMPTS && shouldRetry(result) && !signal.aborted; attempt++) {
    await waitForRetry(signal);
    if (signal.aborted) {
      return result;
    }
    result = await schedulePermissionLookup(request, signal);
  }
  return result;
}
