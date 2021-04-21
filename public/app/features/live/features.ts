import { LiveChannelInfo, LiveChannelType } from '@grafana/data';
import { getDashboardChannelsFeature } from './dashboard/dashboardWatcher';
import { grafanaLiveCoreFeatures } from './scopes';

export function registerLiveFeatures() {
  const channels: LiveChannelInfo[] = [
    // {
    //   addr: {
    //     scope: LiveChannelScope.Grafana
    //   }
    //   path: 'random-2s-stream',
    //   description: 'Random stream with points every 2s',
    // },
    // {
    //   path: 'random-flakey-stream',
    //   description: 'Random stream with flakey data points',
    // },
    // {
    //   path: 'random-20Hz-stream',
    //   description: 'Random stream with points in 20Hz',
    // },
  ];

  grafanaLiveCoreFeatures.register({
    name: 'testdata',
    support: {
      getChannelConfig: (path: string) => {
        return {
          type: LiveChannelType.DataStream,
        };
      },
      getSupportedPaths: () => Promise.resolve(channels),
    },
    description: 'Test data generations',
  });

  grafanaLiveCoreFeatures.register({
    name: 'broadcast',
    support: {
      getChannelConfig: (path: string) => {
        return {
          type: LiveChannelType.JSON,
          canPublish: true,
          description: 'Broadcast any messages to a channel',
        };
      },
      getSupportedPaths: () => Promise.resolve([]),
    },
    description: 'Broadcast will send/receive any JSON object in a channel',
  });

  // dashboard/*
  grafanaLiveCoreFeatures.register(getDashboardChannelsFeature());
}
