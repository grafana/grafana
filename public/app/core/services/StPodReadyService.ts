import { BehaviorSubject } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { getBackendSrv } from '@grafana/runtime';

import { ST_POD_POLL_INTERVAL_MS, ST_POD_READY_TTL_MS, ST_POD_TIMEOUT_MS } from './stPodReadyConstants';

export enum StPodStatus {
  Unknown = 'unknown',
  Waiting = 'waiting',
  Ready = 'ready',
  Timeout = 'timeout',
}

interface PendingResolver {
  promise: Promise<void>;
  resolve: () => void;
}

interface HealthResponse {
  database?: string;
}

const createPending = (): PendingResolver => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

export class StPodReadyService {
  readonly state = new BehaviorSubject<StPodStatus>(StPodStatus.Unknown);

  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private pollAbort: AbortController | null = null;
  private pending: PendingResolver | null = null;
  private readyAt: number | null = null;

  getStatus(): StPodStatus {
    return this.state.getValue();
  }

  useStatus(): StPodStatus {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useObservable(this.state, this.state.getValue());
  }

  getReadyPromise(): Promise<void> {
    if (this.state.getValue() === StPodStatus.Ready) {
      return Promise.resolve();
    }
    return this.ensurePending().promise;
  }

  start(): void {
    this.expireStaleReady();
    if (this.isPolling()) {
      return;
    }
    const status = this.state.getValue();
    if (status === StPodStatus.Ready) {
      return;
    }
    if (status === StPodStatus.Timeout) {
      this.reset();
    }
    this.beginPolling();
  }

  private isPolling(): boolean {
    return this.timeoutTimer !== null || this.pollTimer !== null || this.pollAbort !== null;
  }

  /** Test-only teardown. Not called by the production lifecycle. */
  stop(): void {
    this.clearTimers();
  }

  private expireStaleReady(): void {
    if (this.state.getValue() !== StPodStatus.Ready || !this.isReadyStale()) {
      return;
    }
    this.reset();
  }

  private isReadyStale(): boolean {
    return this.readyAt !== null && Date.now() - this.readyAt > ST_POD_READY_TTL_MS;
  }

  private reset(): void {
    this.clearTimers();
    this.readyAt = null;
    this.resolvePending();
    this.state.next(StPodStatus.Unknown);
  }

  private resolvePending(): void {
    this.pending?.resolve();
    this.pending = null;
  }

  private ensurePending(): PendingResolver {
    if (!this.pending) {
      this.pending = createPending();
    }
    return this.pending;
  }

  private beginPolling(): void {
    this.clearTimers();
    this.timeoutTimer = setTimeout(() => {
      if (this.state.getValue() === StPodStatus.Waiting) {
        this.transitionToTimeout();
      }
    }, ST_POD_TIMEOUT_MS);
    this.poll();
  }

  private async poll(): Promise<void> {
    const abort = new AbortController();
    this.pollAbort = abort;
    try {
      const response: HealthResponse = await getBackendSrv().get('/api/health', undefined, undefined, {
        showErrorAlert: false,
        abortSignal: abort.signal,
      });
      if (abort.signal.aborted) {
        return;
      }
      if (response?.database === 'ok') {
        this.transitionToReady();
      } else {
        this.transitionToWaiting();
      }
    } catch {
      if (abort.signal.aborted) {
        return;
      }
      this.transitionToWaiting();
    } finally {
      if (this.pollAbort === abort) {
        this.pollAbort = null;
      }
      this.schedulePoll();
    }
  }

  private schedulePoll(): void {
    if (this.state.getValue() !== StPodStatus.Waiting && this.state.getValue() !== StPodStatus.Unknown) {
      return;
    }
    if (this.timeoutTimer === null) {
      return;
    }
    this.pollTimer = setTimeout(() => this.poll(), ST_POD_POLL_INTERVAL_MS);
  }

  private transitionToReady(): void {
    if (this.state.getValue() === StPodStatus.Ready) {
      return;
    }
    this.readyAt = Date.now();
    this.state.next(StPodStatus.Ready);
    this.resolvePending();
    this.clearTimers();
  }

  private transitionToWaiting(): void {
    if (this.state.getValue() === StPodStatus.Waiting) {
      return;
    }
    this.readyAt = null;
    this.ensurePending();
    this.state.next(StPodStatus.Waiting);
  }

  private transitionToTimeout(): void {
    if (this.state.getValue() === StPodStatus.Timeout) {
      return;
    }
    this.readyAt = null;
    this.state.next(StPodStatus.Timeout);
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.pollAbort !== null) {
      this.pollAbort.abort();
      this.pollAbort = null;
    }
  }
}
