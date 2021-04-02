import { LiveChannelSupport, LiveChannelConfig } from '@grafana/data';

export class LiveMeasurementsSupport implements LiveChannelSupport {
  private cache: Record<string, LiveChannelConfig> = {};

  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelConfig(path: string): LiveChannelConfig | undefined {
    let c = this.cache[path];
    if (!c) {
      c = {
        path,
      };
    }
    return c;
  }

  /**
   * Return a list of supported channels
   */
  getSupportedPaths(): LiveChannelConfig[] {
    // this should ask the server what channels it has seen
    return [];
  }
}
