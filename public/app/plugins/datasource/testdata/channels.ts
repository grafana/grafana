import { LiveChannelSupport, LiveChannelConfig } from '@grafana/data';

const testHandlers: LiveChannelConfig[] = [{ path: 'random-2s-stream' }];

export const testDataChannelSupport: LiveChannelSupport = {
  /**
   * Get the channel handler for the path, or throw an error if invalid
   */
  getChannelConfig: (path: string) => testHandlers.find(h => h.path === path),

  /**
   * Return a list of supported channels
   */
  getSupportedPaths: () => testHandlers,
};
