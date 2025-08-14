/* eslint-disable no-console */
import { EchoBackend, EchoEvent, EchoEventType, MemoryUsageEchoEvent, isMemoryUsageEvent } from '@grafana/runtime';
import { store } from '@grafana/data';

export interface MemoryUsageBackendOptions {}

/**
 * Echo backend for memory usage events
 * Logs memory events to console only when debug mode is enabled
 */
export class MemoryUsageBackend implements EchoBackend<MemoryUsageEchoEvent, MemoryUsageBackendOptions> {
  private buffer: MemoryUsageEchoEvent[] = [];
  supportedEvents = [EchoEventType.MemoryUsage];

  constructor(public options: MemoryUsageBackendOptions = {}) {}

  addEvent = (e: EchoEvent) => {
    if (isMemoryUsageEvent(e)) {
      this.buffer.push(e);
    }
  };

  flush = () => {
    if (this.buffer.length === 0) {
      return;
    }

    // Log to console only when debug mode is enabled
    const debugEnabled = store.getObject('grafana.debug.memory') === true;

    if (debugEnabled) {
      this.buffer.forEach((event) => {
        console.log('[EchoSrv:memory-usage] Memory measurement:', event.payload);
      });
    }

    // Always clear buffer after processing
    this.buffer = [];
  };
}
