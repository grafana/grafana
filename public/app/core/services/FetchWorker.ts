import { Observable, Subject } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';

import { FetchQueueState } from './FetchQueueState';
import { FetchResponses } from './FetchResponses';

interface FetchWorkerEntry {
  id: string;
  options: BackendSrvRequest;
}

export class FetchWorker {
  private queue: Subject<FetchWorkerEntry> = new Subject<FetchWorkerEntry>();

  constructor(
    state: FetchQueueState,
    responses: FetchResponses,
    fetch: <T>(options: BackendSrvRequest) => Observable<FetchResponse<T>>
  ) {
    this.queue.subscribe(entry => {
      const { id, options } = entry;
      state.setStarted(id);
      responses.publishResponse({
        id,
        observable: fetch(options).pipe(
          finalize(() => {
            console.log(`finalize called for ${id}`);
            state.setEnded(id);
          })
        ),
      });
    });
  }

  addToWork = (id: string, options: BackendSrvRequest): void => {
    this.queue.next({ id, options });
  };
}
