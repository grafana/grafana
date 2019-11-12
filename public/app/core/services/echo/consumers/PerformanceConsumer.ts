import { getBackendSrv } from '@grafana/runtime';
import { EchoConsumer, EchoEvent, EchoEventType } from '../types';
import { Echo } from '../Echo';
import { echoConsumerFactory } from '../echoConsumerFactory';

export interface PerformanceEventPayload {
  metricName: string;
  duration: number;
}

export interface PerformanceEvent extends EchoEvent<EchoEventType.Performance, PerformanceEventPayload> {}

export interface PerformanceConsumerOptions {
  url: string;
}

/**
 * Echo's performance metrics consumer
 * Reports performance metrics to given url
 */
export class PerformanceConsumer implements EchoConsumer<PerformanceEvent, PerformanceConsumerOptions> {
  private consumedPageLoadMetrics = false;
  private buffer: PerformanceEvent[] = [];
  supportedEvents = [EchoEventType.Performance];

  constructor(private echoInstance: Echo, public options: PerformanceConsumerOptions) {}

  consume = (e: EchoEvent) => {
    if (this.supportedEvents.indexOf(e.type) > -1) {
      this.echoInstance.logDebug('Performance consumer consumed: ', e);
      this.buffer.push(e);
    }
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
    if (!this.consumedPageLoadMetrics) {
      this.getPageLoadMetrics();
      this.consumedPageLoadMetrics = true;
    }

    if (this.buffer.length === 0) {
      return;
    }

    const result = {
      metrics: this.buffer,
    };

    this.echoInstance.logDebug('PerformanceConsumer flushing: ', result);

    if (this.options.url) {
      getBackendSrv().post(this.options.url, result);
      this.buffer = [];
    }
  };
}

export const getPerformanceConsumer = (opts: PerformanceConsumerOptions) =>
  echoConsumerFactory(PerformanceConsumer, opts);
