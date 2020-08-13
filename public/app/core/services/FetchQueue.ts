import { Observable, Subject } from 'rxjs';

import { BackendSrvRequest } from '@grafana/runtime';

export interface QueueState extends Record<string, { state: FetchStatus; options: BackendSrvRequest }> {}

export enum FetchStatus {
  Pending,
  InProgress,
  Done,
}

export interface FetchQueueUpdate {
  noOfInProgess: number;
  noOfPending: number;
  state: QueueState;
}

interface QueueStateEntry {
  id: string;
  options?: BackendSrvRequest;
  state: FetchStatus;
}

export class FetchQueue {
  private state: QueueState = {};
  private queue: Subject<QueueStateEntry> = new Subject<QueueStateEntry>();
  private stateChanges: Subject<FetchQueueUpdate> = new Subject<FetchQueueUpdate>();

  constructor(debug = false) {
    this.queue.subscribe(entry => {
      const { id, state, options } = entry;

      if (!this.state[id]) {
        this.state[id] = { state: FetchStatus.Pending, options: {} as BackendSrvRequest };
      }

      if (state === FetchStatus.Done) {
        delete this.state[id];
        const update = this.getUpdate(this.state);
        this.publishUpdate(update, debug);
        return;
      }

      this.state[id].state = state;

      if (options) {
        this.state[id].options = options;
      }

      const update = this.getUpdate(this.state);
      this.publishUpdate(update, debug);
    });
  }

  add = (id: string, options: BackendSrvRequest): void => this.queue.next({ id, options, state: FetchStatus.Pending });

  setStarted = (id: string): void => this.queue.next({ id, state: FetchStatus.InProgress });

  setEnded = (id: string): void => this.queue.next({ id, state: FetchStatus.Done });

  getUpdates = (): Observable<FetchQueueUpdate> => this.stateChanges.asObservable();

  private getUpdate = (state: QueueState): FetchQueueUpdate => {
    const noOfStarted = Object.keys(state).filter(key => state[key].state === FetchStatus.InProgress).length;
    const noOfNotStarted = Object.keys(state).filter(key => state[key].state === FetchStatus.Pending).length;

    return { noOfPending: noOfNotStarted, noOfInProgess: noOfStarted, state };
  };

  private publishUpdate = (update: FetchQueueUpdate, debug: boolean): void => {
    this.printState(update, debug);
    this.stateChanges.next(update);
  };

  private printState = (update: FetchQueueUpdate, debug: boolean) => {
    if (!debug) {
      return;
    }

    const entriesWithoutOptions = Object.keys(update.state).reduce((all, key) => {
      const entry = { id: key, state: update.state[key].state };
      all.push(entry);
      return all;
    }, [] as Array<{ id: string; state: FetchStatus }>);

    console.log('FetchQueue noOfStarted', update.noOfInProgess);
    console.log('FetchQueue noOfNotStarted', update.noOfPending);
    console.log('FetchQueue state', entriesWithoutOptions);
  };
}
