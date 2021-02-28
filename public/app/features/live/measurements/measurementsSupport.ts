import { LiveChannelSupport, LiveChannelConfig } from '@grafana/data';
import { MeasurementCollector } from '@grafana/runtime';

interface MeasurementChannel {
  config: LiveChannelConfig;
  collector: MeasurementCollector;
}

export class LiveMeasurementsSupport implements LiveChannelSupport {
  private cache: Record<string, MeasurementChannel> = {};

  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelConfig(path: string): LiveChannelConfig | undefined {
    let c = this.cache[path];
    if (!c) {
      // Create a new cache for each path
      const collector = new MeasurementCollector();
      c = this.cache[path] = {
        collector,
        config: {
          path,
          processMessage: collector.addBatch, // << this converts the stream from a single event to the whole cache
          getController: () => collector,
          canPublish: () => true,
        },
      };
    }
    return c.config;
  }

  /**
   * Return a list of supported channels
   */
  getSupportedPaths(): LiveChannelConfig[] {
    // this should ask the server what channels it has seen
    return [];
  }
}
