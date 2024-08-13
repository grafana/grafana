import { EchoBackend, EchoEvent, EchoEventType } from '@grafana/runtime';

export interface DashboardRenderBenchmarkPayload {
  interactionType: string;
  duration: number;
  networkDuration: number;
}

export interface DashboardRenderBenchmark
  extends EchoEvent<EchoEventType.Interaction, DashboardRenderBenchmarkPayload> {}

export interface DashboardBenchmarkBackendOptions {
  url?: string;
}

/**
 * Echo's performance metrics consumer
 * Reports performance metrics to given url (TODO)
 */
export class DashboardBenchmarkBackend
  implements EchoBackend<DashboardRenderBenchmark, DashboardBenchmarkBackendOptions>
{
  private buffer: DashboardRenderBenchmarkPayload[] = [];
  supportedEvents = [EchoEventType.Interaction];

  constructor(public options: DashboardBenchmarkBackendOptions) {}

  addEvent = (e: EchoEvent) => {
    if (e.payload.properties.interactionType) {
      this.buffer.push({
        duration: e.payload.properties.duration,
        networkDuration: e.payload.properties.networkDuration,
        interactionType: e.payload.properties.interactionType,
      });
    }
  };

  flush = () => {
    return;
  };
}
