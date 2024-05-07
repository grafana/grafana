import { DataQuery, DataQueryRequest, DataQueryResponse, LoadingState, DataFrame } from '@grafana/data';
import { Observable, Subscription } from 'rxjs';

export interface MultiRequestTracker {
  fetchStartTime?: number; // The frontend clock
  fetchEndTime?: number; // The frontend clock
  data?: DataFrame[];
}

export interface RequestLoopOptions<TQuery extends DataQuery = DataQuery> {
  /**
   * If the response needs an additional request to execute, return it here
   */
  getNextQueries: (rsp: DataQueryResponse) => TQuery[] | undefined;

  /**
   * The datasource execute method
   */
  query: (req: DataQueryRequest<TQuery>) => Observable<DataQueryResponse>;

  /**
   * Process the results
   */
  process: (tracker: MultiRequestTracker, data: DataFrame[], isLast: boolean) => DataFrame[];

  /**
   * Callback that gets executed when unsubscribed
   */
  onCancel: (tracker: MultiRequestTracker) => void;
}

/**
 * Continue executing requests as long as `getNextQuery` returns a query
 */
export function getRequestLooper<T extends DataQuery = DataQuery>(
  req: DataQueryRequest<T>,
  options: RequestLoopOptions<T>
): Observable<DataQueryResponse> {
  return new Observable<DataQueryResponse>((subscriber) => {
    let nextQueries: T[] | undefined = undefined;
    let subscription: Subscription | undefined = undefined;
    const tracker: MultiRequestTracker = {
      fetchStartTime: Date.now(),
      fetchEndTime: undefined,
    };
    let loadingState: LoadingState | undefined = LoadingState.Loading;
    let count = 1;

    // Single observer gets reused for each request
    const observer = {
      next: (rsp: DataQueryResponse) => {
        tracker.fetchEndTime = Date.now();
        loadingState = rsp.state;
        if (loadingState !== LoadingState.Error) {
          nextQueries = options.getNextQueries(rsp);
          loadingState = nextQueries ? LoadingState.Streaming : LoadingState.Done;
        }
        const data = options.process(tracker, rsp.data, !!!nextQueries);
        subscriber.next({ ...rsp, data, state: loadingState, key: req.requestId });
      },
      error: (err: any) => {
        subscriber.error(err);
      },
      complete: () => {
        if (subscription) {
          subscription.unsubscribe();
          subscription = undefined;
        }

        // Let the previous request finish first
        if (nextQueries) {
          tracker.fetchEndTime = undefined;
          tracker.fetchStartTime = Date.now();
          subscription = options
            .query({
              ...req,
              requestId: `${req.requestId}.${++count}`,
              startTime: tracker.fetchStartTime,
              targets: nextQueries,
            })
            .subscribe(observer);
          nextQueries = undefined;
        } else {
          subscriber.complete();
        }
      },
    };

    // First request
    subscription = options.query(req).subscribe(observer);

    return () => {
      nextQueries = undefined;
      observer.complete();
      if (!tracker.fetchEndTime) {
        options.onCancel(tracker);
      }
    };
  });
}
