import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

import { backendSrv } from '../../backend_srv';

export interface PerformanceEventPayload {
  name: string;
  value: number;
}

export interface PerformanceEvent extends EchoEvent<EchoEventType.Performance, PerformanceEventPayload> {}

export interface PerformanceBackendOptions {
  url?: string;
}

/**
 * Echo's performance metrics consumer
 * Reports performance metrics to given url (TODO)
 */
export class PerformanceBackend implements EchoBackend<PerformanceEvent, PerformanceBackendOptions> {
  private buffer: PerformanceEventPayload[] = [];
  supportedEvents = [EchoEventType.Performance];

  constructor(public options: PerformanceBackendOptions) {}

  addEvent = (e: EchoEvent) => {
    this.buffer.push(e.payload);
  };

  flush = () => {
    if (this.buffer.length === 0) {
      return;
    }

    backendSrv
      .post(
        '/api/frontend-metrics',
        {
          events: this.buffer,
        },
        { showErrorAlert: false }
      )
      .catch(() => {
        // Just swallow this error - it's non-critical
      });

    this.buffer = [];
  };
}
