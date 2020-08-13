import { concatMap, filter } from 'rxjs/operators';

import { FetchQueue, FetchStatus } from './FetchQueue';
import { BackendSrvRequest } from '@grafana/runtime';
import { isDataQuery } from '../utils/query';
import { ResponseQueue } from './ResponseQueue';

interface WorkerEntry {
  id: string;
  options: BackendSrvRequest;
}

const MAX_CONCURRENT_DATA_REQUESTS = 5;

export class FetchQueueWorker {
  constructor(fetchQueue: FetchQueue, responseQueue: ResponseQueue) {
    fetchQueue
      .getUpdates()
      .pipe(
        filter(({ noOfPending }) => noOfPending > 0),
        // using concatMap instead of mergeMap so that the order with apiRequests first is preserved
        concatMap(({ state, noOfInProgess }) => {
          const apiRequests = Object.keys(state)
            .filter(k => state[k].state === FetchStatus.Pending && !isDataQuery(state[k].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          const dataRequests = Object.keys(state)
            .filter(key => state[key].state === FetchStatus.Pending && isDataQuery(state[key].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          // apiRequests have precedence over data requests and should always be called
          // this means we can end up with a negative value so therefore we use Math.max below
          const noOfAllowedDataRequests = Math.max(
            MAX_CONCURRENT_DATA_REQUESTS - noOfInProgess - apiRequests.length,
            0
          );
          const dataRequestToFetch = dataRequests.slice(0, noOfAllowedDataRequests);

          return apiRequests.concat(dataRequestToFetch);
        })
      )
      .subscribe(({ id, options }) => responseQueue.add(id, options));
  }
}
