import { Observable, Subscription, timer } from 'rxjs';
import { FetchError, toDataQueryResponse } from '@grafana/runtime';
import { mergeMap } from 'rxjs/operators';
import { StartQueryRequest } from '../types';
import { DataFrame, DataFrameJSON, DataQueryError } from '@grafana/data';

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

type Result = { frames: DataFrameJSON[]; error?: string };

export function runWithRetry(
  queryFun: (targets: StartQueryRequest[]) => Observable<DataFrame[]>,
  targets: StartQueryRequest[],
  timeout: number
): Observable<{ frames: DataFrame[]; error?: DataQueryError }> {
  const startTime = new Date();
  let retries = 1;
  let timerID: any;
  let subscription: Subscription;
  let collected = {};

  return new Observable((observer) => {
    function run(currentQueryParams: StartQueryRequest[]) {
      subscription = queryFun(currentQueryParams).subscribe({
        next(frames) {
          // In case we successfully finished, merge the current response with whatever we already collected.
          const collectedPreviously = toDataQueryResponse({ data: { results: collected } }).data || [];
          observer.next({ frames: [...collectedPreviously, ...frames] });
        },
        error(error: FetchError<{ results?: Record<string, Result> }> | string) {
          // In case of error we first try to figure out what kind of error it is

          // This means it was a generic 500 error probably so we just pass it on
          if (typeof error === 'string') {
            observer.error(error);
            return;
          }

          // In case of multiple queries this some can error while some may be ok
          const errorData = splitErrorData(error);

          if (!errorData) {
            // Not sure what happened but the error structure wasn't what we expected
            observer.error(error);
            return;
          }

          if (!errorData!.errors.length) {
            // So there is no limit error but some other errors so nothing to retry so we just pass it as it would be
            // otherwise.
            observer.error(error);
            return;
          }

          if (startTime.valueOf() + timeout < Date.now()) {
            // We timed out but we could have started some queries
            if (Object.keys(collected).length) {
              const dataResponse = toDataQueryResponse({
                data: {
                  results: {
                    ...(error.data?.results ?? {}),
                    ...collected,
                  },
                },
              });
              dataResponse.error = {
                ...(dataResponse.error ?? {}),
                message: `Some queries timed out: ${dataResponse.error?.message}`,
              };
              observer.next({
                error: dataResponse.error,
                frames: dataResponse.data,
              });
            } else {
              const dataResponse = toDataQueryResponse({ data: { results: error.data?.results ?? {} } });
              observer.error(dataResponse.error);
            }
            return;
          }

          collected = {
            ...collected,
            ...errorData!.good,
          };

          console.log(`Attempt ${retries}: retrying in ${retries * 1000}ms`);
          timerID = setTimeout(() => {
            run(errorData!.errors);
          }, retries * 1000);
        },
      });
    }
    run(targets);
    return () => {
      clearTimeout(timerID);
      subscription.unsubscribe();
    };
  });
}

function splitErrorData(error: FetchError<{ results?: Record<string, Result> }>) {
  const results = error.data?.results;
  if (!results) {
    return undefined;
  }
  return Object.keys(results).reduce<{ errors: StartQueryRequest[]; good: Record<string, Result> }>(
    (acc, refId) => {
      if (results[refId].error?.startsWith('LimitExceededException')) {
        acc.errors.push(error.config.data.queries.find((q: any) => q.refId === refId));
      } else {
        acc.good[refId] = results[refId];
      }
      return acc;
    },
    { errors: [], good: {} }
  );
}
