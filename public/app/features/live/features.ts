import { LiveChannelConfig } from '@grafana/data';
import { getDashboardChannelsFeature } from './dashboard/dashboardWatcher';
import { grafanaLiveCoreFeatures } from './scopes';
import { grafanaLiveMetrics } from '../../plugins/datasource/grafana/live';

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

  grafanaLiveCoreFeatures.register({
    name: 'testdata',
    support: {
      getChannelConfig: (path: string) => {
        return channels.find(c => c.path === path);
      },
      getSupportedPaths: () => channels,
    },
    description: 'Test data generations',
  });

  const chatConfig: LiveChannelConfig = {
    path: 'chat',
    description: 'Broadcast text messages to a channel',
    canPublish: () => true,
    hasPresense: true,
  };

  grafanaLiveCoreFeatures.register({
    name: 'experimental',
    support: {
      getChannelConfig: (path: string) => {
        if ('chat' === path) {
          return chatConfig;
        }
        throw new Error('invalid path: ' + path);
      },
      getSupportedPaths: () => [chatConfig],
    },
    description: 'Experimental features',
  });

  grafanaLiveCoreFeatures.register({
    name: 'metrics',
    support: grafanaLiveMetrics,
    description: 'Real-time server metrics',
  });

  // dashboard/*
  grafanaLiveCoreFeatures.register(getDashboardChannelsFeature());
}
