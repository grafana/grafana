import { Observable, Subject } from 'rxjs';
import { filter, finalize } from 'rxjs/operators';
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
  private queue: Subject<FetchWorkEntry> = new Subject<FetchWorkEntry>();
  private responses: Subject<FetchResponsesEntry<any>> = new Subject<FetchResponsesEntry<any>>();

  constructor(state: FetchQueue, fetch: <T>(options: BackendSrvRequest) => Observable<FetchResponse<T>>) {
    this.queue.subscribe(entry => {
      const { id, options } = entry;
      state.setStarted(id);

      this.responses.next({ id, observable: fetch(options).pipe(finalize(() => state.setEnded(id))) });
    });
  }

  add = (id: string, options: BackendSrvRequest): void => {
    this.queue.next({ id, options });
  };

  getResponses = <T>(id: string): Observable<FetchResponsesEntry<T>> =>
    this.responses.asObservable().pipe(filter(entry => entry.id === id));
}
