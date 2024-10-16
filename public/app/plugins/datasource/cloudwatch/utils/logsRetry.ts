import { Observable, Subscription } from 'rxjs';

import { DataFrame, DataFrameJSON, DataQueryError, DataQueryResponse } from '@grafana/data';
import { FetchError } from '@grafana/runtime';

import { StartQueryRequest } from '../types';

type Result = { frames: DataFrameJSON[]; error?: string };

/**
 * A retry strategy specifically for cloud watch logs query. Cloud watch logs queries need first starting the query
 * and the polling for the results. The start query can fail because of the concurrent queries rate limit,
 * and so we have to retry the start query call if there is already lot of queries running.
 *
 * As we send multiple queries in a single request some can fail and some can succeed and we have to also handle those
 * cases by only retrying the failed queries. We retry the failed queries until we hit the time limit or all queries
 * succeed and only then we pass the data forward. This means we wait longer but makes the code a bit simpler as we
 * can treat starting the query and polling as steps in a pipeline.
 * @param queryFun
 * @param targets
 * @param options
 */
export function runWithRetry(
  queryFun: (targets: StartQueryRequest[]) => Observable<DataQueryResponse>,
  targets: StartQueryRequest[],
  timeoutFunc: (retry: number, startTime: number) => boolean
): Observable<DataQueryResponse> {
  const startTime = new Date();
  let retries = 0;
  let timerID: ReturnType<typeof setTimeout>;
  let subscription: Subscription;
  let collected: { data: DataFrame[]; errors: DataQueryError[] } = { data: [], errors: [] };
  // This function is used to calculate the time to wait before retrying the query.
  const retryWaitFunction = (retry: number) => {
    return Math.pow(2, retry) * 1000 + Math.random() * 100;
  };

  return new Observable((observer) => {
    // Run function is where the logic takes place. We have it in a function so we can call it recursively.
    function run(currentQueryParams: StartQueryRequest[]) {
      subscription = queryFun(currentQueryParams).subscribe({
        next(response: DataQueryResponse) {
          if (response.errors) {
            const { refIdsForRequestsToRetry, errorsNotToRetry } = splitErrorsData(response.errors);
            if (refIdsForRequestsToRetry.length > 0) {
              if (!timeoutFunc(retries, startTime.valueOf())) {
                // store the responses we are not retrying
                collected.data = [...collected.data, ...response.data];
                collected.errors = [...collected.errors, ...errorsNotToRetry];

                // We retry only the failed queries
                timerID = setTimeout(
                  () => {
                    retries++;
                    run(currentQueryParams.filter((query) => refIdsForRequestsToRetry.includes(query.refId)));
                  },
                  // We want to know how long to wait for the next retry. First time this will be 0.
                  retryWaitFunction(retries + 1)
                );

                // we return early. The observer.next will be called whenever the timeout finisies or there are no errors.
                return;
              }
            }
          }

          // if the timeout is done or it was never called we take what we have from past retries and the current round
          collected.data = [...collected.data, ...response.data];
          collected.errors = [
            ...collected.errors,
            ...(response.errors && response.errors.length > 0 ? response.errors : []),
          ];
          observer.next(collected);
          observer.complete();
        },
        // if the server returns a raw string 5xx error, something is very unexpectedly wrong and we just forward it
        error(error: FetchError<{ results?: Record<string, Result> }> | string) {
          observer.error(error);
        },
      });
    }

    run(targets);
    return () => {
      // We clear only the latest timer and subscription but the observable should complete after one response so
      // there should not be more things running at the same time.
      clearTimeout(timerID);
      subscription.unsubscribe();
    };
  });
}

function splitErrorsData(errors: DataQueryError[]) {
  const refIdsForRequestsToRetry: string[] = [];
  const errorsNotToRetry: DataQueryError[] = [];
  errors.map((err) => {
    if (
      err?.refId &&
      (err.message?.includes('LimitExceededException') || err.message?.includes('ThrottlingException'))
    ) {
      refIdsForRequestsToRetry.push(err.refId);
    } else {
      errorsNotToRetry.push(err);
    }
  });
  return { refIdsForRequestsToRetry, errorsNotToRetry };
}
