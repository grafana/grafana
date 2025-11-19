import { DataQueryError, DataQueryResponse } from '@grafana/data';
import { is4xxError } from '@grafana-plugins/loki/responseUtils';

// Currently we can only infer if an error response is a timeout or not.
export function isClientErrorResponse(response: DataQueryResponse | undefined): boolean {
  if (!response) {
    return false;
  }
  if (!response.error && !response.errors) {
    return false;
  }

  const errors = response.error ? [response.error] : response.errors || [];

  return errors.some((error: DataQueryError) => {
    const message = `${error.message || error.data?.message}`?.toLowerCase();
    return (
      message.includes('timeout') || message?.includes('the query would read too many bytes') || is4xxError(response)
    );
  });
}
