import { Observable, Subject } from 'rxjs';

import { BackendSrvRequest } from '@grafana/runtime';

export interface QueueState extends Record<string, { state: FetchQueueStateStatus; options: BackendSrvRequest }> {}

interface QueueStateEntry {
  id: string;
  options?: BackendSrvRequest;
  state: FetchQueueStateStatus;
}

interface StateEntry {
  id: string;
  options: BackendSrvRequest;
}

export enum FetchQueueStateStatus {
  NotStarted,
  Started,
  Ended,
}

export class FetchQueueState {
  private state: QueueState = {};
  private queue: Subject<QueueStateEntry> = new Subject<QueueStateEntry>();
  private queueState: Subject<QueueState> = new Subject<QueueState>();

  constructor() {
    this.queue.subscribe(entry => {
      const { id, state, options } = entry;

      if (!this.state[id]) {
        this.state[id] = { state: FetchQueueStateStatus.NotStarted, options: {} as BackendSrvRequest };
      }

      this.state[id].state = state;

      if (options) {
        this.state[id].options = options;
      }

      this.queueState.next(this.state);
    });
  }

  addEntry = (id: string, options: BackendSrvRequest): void =>
    this.queue.next({ id, options, state: FetchQueueStateStatus.NotStarted });

  setStarted = (id: string): void => this.queue.next({ id, state: FetchQueueStateStatus.Started });

  setEnded = (id: string): void => this.queue.next({ id, state: FetchQueueStateStatus.Ended });

  getState = (): Observable<QueueState> => this.queueState.asObservable();
}
