import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { FetchResponse } from '@grafana/runtime';

interface FetchResponsesEntry<T> {
  id: string;
  observable: Observable<FetchResponse<T>>;
}

export class FetchResponses {
  private queue: Subject<FetchResponsesEntry<any>> = new Subject<FetchResponsesEntry<any>>();

  constructor() {
    this.queue.subscribe(entry => {
      console.log('FetchResponses', entry);
    });
  }

  publishResponse = (response: FetchResponsesEntry<any>): void => this.queue.next(response);

  getObservable = <T>(id: string): Observable<FetchResponsesEntry<T>> =>
    this.queue.asObservable().pipe(filter(entry => entry.id === id));
}
