import { DataQueryError, DataQueryResponse } from '@grafana/data';

export const LOKI_MAX_QUERY_BYTES_READ_ERROR_MSG_PREFIX = 'the query would read too many bytes';
export const LOKI_TIMEOUT_ERROR_MSG = 'timeout';

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
    return message.includes(LOKI_TIMEOUT_ERROR_MSG);
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
    return message?.includes(LOKI_MAX_QUERY_BYTES_READ_ERROR_MSG_PREFIX);
  });
}
