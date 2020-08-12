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
        filter(({ noOfNotStarted }) => noOfNotStarted > 0),
        concatMap(({ state, noOfStarted }) => {
          const apiCalls = Object.keys(state)
            .filter(k => state[k].state === FetchStatus.NotStarted && !isDataQuery(state[k].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          const dataRequests = Object.keys(state)
            .filter(key => state[key].state === FetchStatus.NotStarted && isDataQuery(state[key].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          const noOfAllowedDataRequests = Math.max(MAX_CONCURRENT_DATA_REQUESTS - noOfStarted - apiCalls.length, 0);
          const dataRequestToFetch = dataRequests.slice(0, noOfAllowedDataRequests);

          return apiCalls.concat(dataRequestToFetch);
        })
      )
      .subscribe(({ id, options }) => responseQueue.add(id, options));
  }
}
