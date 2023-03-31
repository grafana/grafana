import { DataQueryError, DataQueryResponse } from '@grafana/data';

// Currently we can only infer if an error response is a timeout or not.
// TODO: add backend support for specifying the type of error.
export function isTimeoutErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response?.error && !response?.errors) {
    return false;
  }

  const errors = response.error ? [response.error] : response.errors || [];

  return errors.reduce((isTimeoutError: boolean, error: DataQueryError) => {
    const message = `${error.message || error.data?.message}`?.toLowerCase();
    return isTimeoutError || message.includes('timeout');
  }, false);
}
