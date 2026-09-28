import { type DataQueryError } from '@grafana/data';

/**
 * Convert an object into a DataQueryError -- if this is an HTTP response,
 * it will put the correct values in the error field
 *
 * @public
 */
export function toDataQueryError(err: DataQueryError | string | unknown): DataQueryError {
  const error: DataQueryError = err || {};

  if (error.message) {
    return error;
  }

  if (typeof err === 'string') {
    return { message: err };
  }

  let message = 'Query error';
  if (error.data && error.data.message && error.data?.message !== 'Query data error') {
    message = error.data.message;
  } else if (error?.data?.message === 'Query data error' && error?.data?.error) {
    message = error.data.error;
  } else if (error.data && error.data.error) {
    message = error.data.error;
  } else if (error.status) {
    message = `Query error: ${error.status} ${error.statusText}`;
  }

  // Normally we attach the message to the object we were given. But objects that went through
  // the Redux store are frozen by immer, so we copy instead of writing to them.
  if (!Object.isExtensible(error)) {
    const copy: DataQueryError & { stack?: string } = { ...error, message };

    // The spread above misses stack, since it's not an enumerable property. We keep it here
    // because it's often the only clue about where the error came from.
    // The typeof check matters: a thrown primitive also lands here, and `in` rejects those.
    if (copy.stack === undefined && typeof error === 'object' && 'stack' in error && typeof error.stack === 'string') {
      copy.stack = error.stack;
    }

    return copy;
  }

  error.message = message;
  return error;
}
