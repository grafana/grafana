import { BehaviorSubject } from 'rxjs';

import { useObservable } from '@grafana/data/unstable';
import { getBackendSrv } from '@grafana/runtime';

export enum StPodStatus {
  Unknown = 'unknown',
  Waiting = 'waiting',
  Ready = 'ready',
  Timeout = 'timeout',
}

export const ST_POD_TIMEOUT_MS = 5 * 60 * 1000;
export const ST_POD_POLL_INTERVAL_MS = 10 * 1000;
export const ST_POD_READY_TTL_MS = 60 * 60 * 1000;

interface PendingResolver {
  promise: Promise<void>;
  resolve: () => void;
}

interface HealthResponse {
  database?: string;
}

const isTerminal = (status: StPodStatus): boolean => status === StPodStatus.Ready || status === StPodStatus.Timeout;

const createPending = (): PendingResolver => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

export class StPodReadinessService {
  readonly state = new BehaviorSubject<StPodStatus>(StPodStatus.Unknown);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
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
    if (this.getStatus() === StPodStatus.Ready) {
      return Promise.resolve();
    }
    if (!this.pending) {
      this.pending = createPending();
    }
    return this.pending.promise;
  }

  start(): void {
    if (this.pollTimer !== null) {
      return;
    }
    const status = this.getStatus();
    if (status === StPodStatus.Ready && !this.isReadyStale()) {
      return;
    }
    if (isTerminal(status)) {
      this.reset();
    }
    this.beginPolling();
  }

  stop(): void {
    this.clearTimers();
  }

  private isReadyStale(): boolean {
    return this.readyAt !== null && Date.now() - this.readyAt > ST_POD_READY_TTL_MS;
  }

  private reset(): void {
    this.readyAt = null;
    this.pending?.resolve();
    this.pending = null;
    this.state.next(StPodStatus.Unknown);
  }

  private beginPolling(): void {
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), ST_POD_POLL_INTERVAL_MS);
    this.timeoutTimer = setTimeout(() => {
      if (this.getStatus() === StPodStatus.Waiting) {
        this.markTimeout();
      }
    }, ST_POD_TIMEOUT_MS);
  }

  private async poll(): Promise<void> {
    try {
      const response: HealthResponse = await getBackendSrv().get('/api/health');
      if (response?.database === 'ok') {
        this.markReady();
      } else {
        this.markWaiting();
      }
    } catch {
      this.markWaiting();
    }
  }

  private markReady(): void {
    if (this.getStatus() === StPodStatus.Ready) {
      return;
    }
    this.readyAt = Date.now();
    this.state.next(StPodStatus.Ready);
    this.pending?.resolve();
    this.clearTimers();
  }

  private markWaiting(): void {
    if (this.getStatus() === StPodStatus.Waiting) {
      return;
    }
    if (!this.pending) {
      this.pending = createPending();
    }
    this.state.next(StPodStatus.Waiting);
  }

  private markTimeout(): void {
    if (this.getStatus() === StPodStatus.Timeout) {
      return;
    }
    this.state.next(StPodStatus.Timeout);
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}
