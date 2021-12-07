import { BackendSrvRequest, FetchResponse } from '@grafana/runtime/src';
import store, { Store } from 'app/core/store';

export const STORE_KEY = 'grafana.dashboard.recordings';

export interface RequestResponseRecording {
  options: BackendSrvRequest;
  fetchResponse: FetchResponse;
}

export interface RecordsRequestResponse {
  start: () => void;
  stop: () => void;
  isRecording: () => boolean;
  record: (recording: RequestResponseRecording) => void;
  get: () => RequestResponseRecording[];
}

class RequestResponseRecorder implements RecordsRequestResponse {
  private recordings: RequestResponseRecording[] = [];
  constructor(private readonly store: Store) {}

  start() {
    this.store.setObject(STORE_KEY, []);
  }

  stop() {
    this.recordings = this.store.getObject(STORE_KEY, []);
    this.store.delete(STORE_KEY);
  }

  isRecording() {
    return this.store.exists(STORE_KEY);
  }

  get() {
    return this.recordings;
  }

  record(recording: RequestResponseRecording) {
    if (!this.isRecording()) {
      return;
    }

    const recordings: RequestResponseRecording[] = this.store.getObject(STORE_KEY, []);
    recordings.push(recording);
    this.store.setObject(STORE_KEY, recordings.concat(recording));
  }
}

let requestResponseRecorder: RecordsRequestResponse = new RequestResponseRecorder(store);

export const setRequestResponseRecorder = (recorder: RecordsRequestResponse) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('RequestResponseRecorder can be only overriden in test environment');
  }
  requestResponseRecorder = recorder;
};

export const getRequestResponseRecorder = () => requestResponseRecorder;
