import { EchoBackend, EchoEvent, EchoEventType } from '../types';
import { Echo } from '../Echo';
import { echoBackendFactory } from './echoBackendFactory';

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
  private collectedPageLoadMetrics = false;
  private buffer: PerformanceEvent[] = [];
  supportedEvents = [EchoEventType.Performance];

  constructor(private echoInstance: Echo, public options: PerformanceBackendOptions) {}

  addEvent = (e: EchoEvent) => {
    this.echoInstance.logDebug('Performance consumer consumed: ', e);
    this.buffer.push(e);
  };

  getPageLoadMetrics = () => {
    const paintMetrics = performance.getEntriesByType('paint');
    for (const metric of paintMetrics) {
      this.buffer.push({
        type: EchoEventType.Performance,
        payload: {
          metricName: metric.name,
          duration: Math.round(metric.startTime + metric.duration),
        },
        meta: { ...this.echoInstance.getMeta() },
        ts: performance.now(),
      });
    }
  };

  flush = () => {
    if (!this.collectedPageLoadMetrics) {
      this.getPageLoadMetrics();
      this.collectedPageLoadMetrics = true;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const result = {
      metrics: this.buffer,
    };

    this.echoInstance.logDebug('PerformanceConsumer flushing: ', result);

    this.buffer = [];

    // TODO: Enable backend request when we have metrics API
    // if (this.options.url) {
    // getBackendSrv().post(this.options.url, result);
    // }
  };
}

export const getPerformanceBackend = (opts: PerformanceBackendOptions) => echoBackendFactory(PerformanceBackend, opts);
