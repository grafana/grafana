import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';

import { FetchQueue } from './FetchQueue';

interface FetchWorkEntry {
  id: string;
  options: BackendSrvRequest;
}

interface FetchResponsesEntry<T> {
  id: string;
  observable: Observable<FetchResponse<T>>;
}

export class ResponseQueue {
  private queue: Subject<FetchWorkEntry> = new Subject<FetchWorkEntry>(); // internal stream for requests that are to be executed
  private responses: Subject<FetchResponsesEntry<any>> = new Subject<FetchResponsesEntry<any>>(); // external stream with responses from fetch

  constructor(fetchQueue: FetchQueue, fetch: <T>(options: BackendSrvRequest) => Observable<FetchResponse<T>>) {
    // This will create an implicit live subscription for as long as this class lives.
    // But as FetchQueue is used by the singleton backendSrv that also lives for as long as Grafana app lives
    // I think this ok. We could add some disposable pattern later if the need arises.
    this.queue.subscribe((entry) => {
      const { id, options } = entry;

      // Let the fetchQueue know that this id has started data fetching.
      fetchQueue.setInProgress(id);

      this.responses.next({ id, observable: fetch(options) });
    });
  }

  add = (id: string, options: BackendSrvRequest): void => {
    this.queue.next({ id, options });
  };

  getResponses = <T>(id: string): Observable<FetchResponsesEntry<T>> =>
    this.responses.asObservable().pipe(filter((entry) => entry.id === id));
}
