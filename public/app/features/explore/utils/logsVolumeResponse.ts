import { DataQueryError, DataQueryResponse } from '@grafana/data';

// Currently we can only infer if an error response is a timeout or not.
export function isTimeoutErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response?.error && !response?.errors) {
    return false;
  }

  const errors = response?.error ? [response?.error] : response?.errors || [];

  return errors.some((error: DataQueryError) => {
    const message = `${error.message || error.data?.message}`?.toLowerCase();
    return message.includes('timeout');
  });
}
