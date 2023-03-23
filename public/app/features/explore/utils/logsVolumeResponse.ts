// Currently we can only infer if an error response is a timeout or not.
// TODO: add backend support for specifying the type of error.
import { DataQueryResponse } from '@grafana/data';

const timeoutKeywords = ['timeout', 'exceeded'];

export function isTimeoutErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response?.error && response?.errors) {
    return false;
  }

  const errors = response?.error ? [response?.error] : response?.errors || [];

  return errors.reduce((isTimeoutError, error) => {
    if (isTimeoutError) {
      return true;
    }
    return timeoutKeywords.reduce(
      (timeoutFound, keyword) =>
        timeoutFound || Boolean(error.message?.includes(keyword) || error.data?.message?.includes(keyword)),
      false
    );
  }, false);
}
