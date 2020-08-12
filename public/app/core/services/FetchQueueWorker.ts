import { concatMap, filter } from 'rxjs/operators';

import { FetchQueueState, FetchQueueStateStatus } from './FetchQueueState';
import { FetchWorker } from './FetchWorker';
import { BackendSrvRequest } from '@grafana/runtime';
import { isDataQuery } from '../utils/query';

interface WorkerEntry {
  id: string;
  options: BackendSrvRequest;
}

export class FetchQueueWorker {
  constructor(queueState: FetchQueueState, worker: FetchWorker) {
    queueState
      .getState()
      .pipe(
        filter(
          state => Object.keys(state).filter(key => state[key].state === FetchQueueStateStatus.NotStarted).length > 0
        ),
        concatMap(state => {
          const noOfStarted = Object.keys(state).filter(key => state[key].state === FetchQueueStateStatus.Started)
            .length;

          const apiCalls = Object.keys(state)
            .filter(k => state[k].state === FetchQueueStateStatus.NotStarted && !isDataQuery(state[k].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          const dataRequests = Object.keys(state)
            .filter(key => state[key].state === FetchQueueStateStatus.NotStarted && isDataQuery(state[key].options.url))
            .reduce((all, key) => {
              const entry = { id: key, options: state[key].options };
              all.push(entry);
              return all;
            }, [] as WorkerEntry[]);

          const noOfAllowedDataRequests = 5 - noOfStarted - apiCalls.length;
          const dataRequestToFetch = dataRequests.slice(0, noOfAllowedDataRequests);

          return apiCalls.concat(dataRequestToFetch);
        })
      )
      .subscribe(({ id, options }) => {
        worker.addToWork(id, options);
      });
  }
}
