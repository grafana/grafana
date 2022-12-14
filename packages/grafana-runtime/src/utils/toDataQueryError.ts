import { DataQueryError } from '@grafana/data';

/**
 * Convert an object into a DataQueryError -- if this is an HTTP response,
 * it will put the correct values in the error field
 *
 * @public
 */
export function toDataQueryError(err: DataQueryError | string | unknown): DataQueryError {
  const error = (err || {}) as DataQueryError;

  if (!error.message) {
    if (typeof err === 'string' || err instanceof String) {
      return { message: err } as DataQueryError;
    }

    let message = 'Query error';
    if (error.message) {
      message = error.message;
    } else if (error.data && error.data.message && error.data?.message !== 'Query data error') {
      message = error.data.message;
    } else if (error?.data?.message === 'Query data error' && error?.data?.error) {
      message = error.data.error;
    } else if (error.data && error.data.error) {
      message = error.data.error;
    } else if (error.status) {
      message = `Query error: ${error.status} ${error.statusText}`;
    }
    error.message = message;
  }

  return error;
}
