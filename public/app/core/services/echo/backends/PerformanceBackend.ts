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

    // Currently we don't have an API for sending the metrics hence logging to console in dev environment
    if (process.env.NODE_ENV === 'development') {
      console.log('PerformanceBackend flushing:', this.buffer);
    }

    backendSrv.post('/api/frontend-metrics', {
      events: this.buffer,
    });

    this.buffer = [];
  };
}
