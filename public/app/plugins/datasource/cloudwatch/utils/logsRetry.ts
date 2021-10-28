import { Observable, timer } from 'rxjs';
import { FetchError } from '@grafana/runtime';
import { mergeMap } from 'rxjs/operators';

type options = {
  maxRetryAttempts?: number;
  scalingDuration?: number;
};

type DSError = FetchError<{ results?: Record<string, { error?: string }> }>;

export const logsRetryStrategy = ({ maxRetryAttempts = 3, scalingDuration = 1000 }: options = {}) => (
  attempts: Observable<any>
) => {
  return attempts.pipe(
    mergeMap((error: DSError | string, i) => {
      // We get 500 errors as string here but we can ignore them as we do not want to retry those
      if (typeof error === 'string') {
        throw error;
      }

      if (!isQueryConcurrencyLimitError(error)) {
        throw error;
      }

      const retryAttempt = i + 1;
      if (retryAttempt > maxRetryAttempts) {
        throw error;
      }

      console.log(`Attempt ${retryAttempt}: retrying in ${retryAttempt * scalingDuration}ms`);
      // retry after 1s, 2s, etc...
      return timer(retryAttempt * scalingDuration);
    })
  );
};

function isQueryConcurrencyLimitError(error: DSError) {
  return error.data?.results
    ? Object.values(error.data?.results).some((v) => v.error?.startsWith('LimitExceededException'))
    : false;
}
