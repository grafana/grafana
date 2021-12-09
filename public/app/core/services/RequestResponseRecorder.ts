import { BackendSrvRequest, FetchResponse, locationService } from '@grafana/runtime/src';
import { Store } from 'app/core/store';

export const STORE_KEY = 'grafana.dashboard.isRecording';

export interface RequestResponseRecording {
  options: BackendSrvRequest;
  fetchResponse: FetchResponse;
}

export interface RecordsRequestResponse {
  start: () => void;
  stop: () => RequestResponseRecording[];
  isRecording: () => boolean;
  record: (recording: RequestResponseRecording) => void;
}

class RequestResponseRecorder implements RecordsRequestResponse {
  private recordings: RequestResponseRecording[] = [];
  constructor(private readonly store: Store) {}

  start() {
    this.store.set(STORE_KEY, true);
    locationService.reload();
  }

  stop(): RequestResponseRecording[] {
    if (!this.isRecording()) {
      return [];
    }

    this.store.delete(STORE_KEY);
    return this.recordings;
  }

  isRecording() {
    if (this.store.exists(STORE_KEY)) {
      return this.store.get(STORE_KEY);
    }

    return false;
  }

  record(recording: RequestResponseRecording) {
    if (!this.isRecording()) {
      return;
    }

    this.recordings = this.recordings.concat(recording);
  }
}

let requestResponseRecorder: RecordsRequestResponse = new RequestResponseRecorder(new Store('session'));

export const setRequestResponseRecorder = (recorder: RecordsRequestResponse) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('RequestResponseRecorder can be only overriden in test environment');
  }
  requestResponseRecorder = recorder;
};

export const getRequestResponseRecorder = () => requestResponseRecorder;
