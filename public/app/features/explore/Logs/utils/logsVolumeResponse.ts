import { DataQueryError, DataQueryResponse } from '@grafana/data';

export function isTimeoutErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response.error && !response.errors) {
    return false;
  }

  const errors = response.error ? [response.error] : response.errors || [];

  return errors.some((error: DataQueryError) => {
    const message = `${error.message || error.data?.message}`?.toLowerCase();
    return message.includes('timeout') || message?.includes('the query would read too many bytes');
  });
}

export function isMaxBytesErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response.error && !response.errors) {
    return false;
  }

  const errors = response.error ? [response.error] : response.errors || [];

  return errors.some((error: DataQueryError) => {
    const message = `${error.message || error.data?.message}`?.toLowerCase();
    return message?.includes('the query would read too many bytes');
  });
}
