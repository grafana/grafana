import { ChannelSupport, ChannelHandler } from '@grafana/data';

const chatHandler: ChannelHandler = {
  // Allow publishing
  onPublish: (body: any) => body,
};

/**
 * The "grafana" namespace is hardcoded to load this configuration
 */
export const coreGrafanaSupport: ChannelSupport = {
  getChannelHandler: (path: string) => {
    if (path === 'example-chat') {
      return chatHandler;
    }
    throw new Error('unsupported channel');
  },

  getChannels: () => [
    {
      path: 'example-chat',
      description: 'Sample that allows broadcast to everyone',
    },
  ],
};
