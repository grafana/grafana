import { Observable, Subject } from 'rxjs';

import { BackendSrvRequest } from '@grafana/runtime';

export interface QueueState extends Record<string, { state: FetchStatus; options: BackendSrvRequest }> {}

export enum FetchStatus {
  Pending,
  InProgress,
  Done,
}

export interface FetchQueueUpdate {
  noOfInProgress: number;
  noOfPending: number;
  state: QueueState;
}

interface QueueStateEntry {
  id: string;
  options?: BackendSrvRequest;
  state: FetchStatus;
}

export class FetchQueue {
  private state: QueueState = {}; // internal queue state
  private queue: Subject<QueueStateEntry> = new Subject<QueueStateEntry>(); // internal stream for requests that are to be queued
  private updates: Subject<FetchQueueUpdate> = new Subject<FetchQueueUpdate>(); // external stream with updates to the queue state

  constructor(debug = false) {
    // This will create an implicit live subscription for as long as this class lives.
    // But as FetchQueue is used by the singleton backendSrv that also lives for as long as Grafana app lives
    // I think this ok. We could add some disposable pattern later if the need arises.
    this.queue.subscribe((entry) => {
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

  setInProgress = (id: string): void => this.queue.next({ id, state: FetchStatus.InProgress });

  setDone = (id: string): void => this.queue.next({ id, state: FetchStatus.Done });

  getUpdates = (): Observable<FetchQueueUpdate> => this.updates.asObservable();

  private getUpdate = (state: QueueState): FetchQueueUpdate => {
    const noOfInProgress = Object.keys(state).filter((key) => state[key].state === FetchStatus.InProgress).length;
    const noOfPending = Object.keys(state).filter((key) => state[key].state === FetchStatus.Pending).length;

    return { noOfPending, noOfInProgress, state };
  };

  private publishUpdate = (update: FetchQueueUpdate, debug: boolean): void => {
    this.printState(update, debug);
    this.updates.next(update);
  };

  private printState = (update: FetchQueueUpdate, debug: boolean): void => {
    if (!debug) {
      return;
    }

    const entriesWithoutOptions = Object.keys(update.state).reduce<Array<{ id: string; state: FetchStatus }>>(
      (all, key) => {
        const entry = { id: key, state: update.state[key].state };
        all.push(entry);
        return all;
      },
      []
    );

    console.log('FetchQueue noOfStarted', update.noOfInProgress);
    console.log('FetchQueue noOfNotStarted', update.noOfPending);
    console.log('FetchQueue state', entriesWithoutOptions);
  };
}
