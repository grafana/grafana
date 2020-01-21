import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

export interface PerformanceEventPayload {
  metricName: string;
  duration: number;
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
  private buffer: PerformanceEvent[] = [];
  supportedEvents = [EchoEventType.Performance];

  constructor(public options: PerformanceBackendOptions) {}

  addEvent = (e: EchoEvent) => {
    this.buffer.push(e);
  };

  flush = () => {
    if (this.buffer.length === 0) {
      return;
    }

    const result = {
      metrics: this.buffer,
    };

    // Currently we don have API for sending the metrics hence loging to console in dev environment
    if (process.env.NODE_ENV === 'development') {
      console.log('PerformanceBackend flushing:', result);
    }

    this.buffer = [];

    // TODO: Enable backend request when we have metrics API
    // if (this.options.url) {
    // backendSrv.post(this.options.url, result);
    // }
  };
}
