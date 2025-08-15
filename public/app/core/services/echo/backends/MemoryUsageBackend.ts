import { store } from '@grafana/data';
import { EchoBackend, EchoEvent, EchoEventType, MemoryUsageEchoEvent, isMemoryUsageEvent } from '@grafana/runtime';
import { createLogger } from '@grafana/ui';

export interface MemoryUsageBackendOptions {}

/**
 * Echo backend for memory usage events
 * Logs memory events to console only when debug mode is enabled
 */
export class MemoryUsageBackend implements EchoBackend<MemoryUsageEchoEvent, MemoryUsageBackendOptions> {
  private buffer: MemoryUsageEchoEvent[] = [];
  private logger = createLogger('MemoryUsageBackend', 'grafana.debug.memory');
  supportedEvents = [EchoEventType.MemoryUsage];

  constructor(public options: MemoryUsageBackendOptions = {}) {}

  addEvent = (e: EchoEvent) => {
    if (isMemoryUsageEvent(e)) {
      this.logger.logger('addEvent', false, 'called, adding to buffer. Buffer size:', this.buffer.length + 1);
      this.buffer.push(e);
    }
  };

  flush = () => {
    this.logger.logger('flush', false, 'called. Buffer size:', this.buffer.length);

    if (this.buffer.length === 0) {
      return;
    }

    // Log to console only when debug mode is enabled
    const debugEnabled = store.getObject('grafana.debug.memory') === true;
    this.logger.logger('flush', false, 'Debug enabled:', debugEnabled);

    if (debugEnabled) {
      this.buffer.forEach((event) => {
        console.log('[EchoSrv:memory-usage] Memory measurement:', event.payload);
      });
    }

    // Always clear buffer after processing
    this.buffer = [];
  };
}
