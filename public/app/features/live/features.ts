import { LiveChannelConfig } from '@grafana/data';
import { grafanaLiveCoreFeatures } from './scopes';

export function registerLiveFeatures() {
  const channels = [
    {
      path: 'random-2s-stream',
      description: 'Random stream with points every 2s',
    },
    {
      path: 'random-flakey-stream',
      description: 'Random stream with flakey data points',
    },
  ];

  grafanaLiveCoreFeatures.register(
    'testdata',
    {
      getChannelConfig: (path: string) => {
        return channels.find(c => c.path === path);
      },
      getSupportedPaths: () => channels,
    },
    'Test data generations'
  );

  const chatConfig: LiveChannelConfig = {
    path: 'chat',
    description: 'Broadcast text messages to a channel',
    canPublish: () => true,
    hasPresense: true,
  };

  grafanaLiveCoreFeatures.register(
    'experimental',
    {
      getChannelConfig: (path: string) => {
        if ('chat' === path) {
          return chatConfig;
        }
        throw new Error('invalid path: ' + path);
      },
      getSupportedPaths: () => [chatConfig],
    },
    'Experimental features'
  );
}
