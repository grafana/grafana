import { LiveChannelSupport, LiveChannelConfig, LiveChannelType } from '@grafana/data';

/**
 * Generic description of channels that support streams
 *
 * @alpha
 */
export class LiveMeasurementsSupport implements LiveChannelSupport {
  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelConfig(path: string): LiveChannelConfig | undefined {
    return {
      type: LiveChannelType.DataStream,
    };
  }
}
