import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';
import { backendSrv } from '../../backend_srv';

export enum PerformanceEventName {
  frontend_boot_load_time_seconds = 'frontend_boot_load_time_seconds',
  frontend_boot_js_done_time_seconds = 'frontend_boot_js_done_time_seconds',
  frontend_boot_css_time_seconds = 'frontend_boot_css_time_seconds',
  frontend_live_timeseries_data_render_delay = 'frontend_live_timeseries_data_render_delay',
}

export const liveEventNames: string[] = [PerformanceEventName.frontend_live_timeseries_data_render_delay];

export const isLiveEvent = (performanceEvent: PerformanceEvent): boolean =>
  liveEventNames.includes(performanceEvent.payload.name);

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

  private shouldBeSentToBackend = (e: PerformanceEvent) => !isLiveEvent(e);

  addEvent = (e: PerformanceEvent) => {
    if (this.shouldBeSentToBackend(e)) {
      this.buffer.push(e.payload);
    }
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
