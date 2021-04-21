import { LiveChannelSupport, LiveChannelConfig, LiveChannelType, LiveChannelInfo } from '@grafana/data';

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

  /**
   * Return a list of supported channels
   */
  getSupportedPaths(): Promise<LiveChannelInfo[]> {
    // this should ask the server what channels it has seen
    return Promise.resolve([]);
  }
}
