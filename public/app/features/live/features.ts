import { LiveChannelConfig } from '@grafana/data';
import { getDashboardChannelsFeature } from './dashboard/dashboardWatcher';
import { LiveMeasurmentsSupport } from './measurements/measurementsSupport';
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

  const broadcastConfig: LiveChannelConfig = {
    path: '${path}',
    description: 'Broadcast any messages to a channel',
    canPublish: () => true,
  };

  grafanaLiveCoreFeatures.register({
    name: 'broadcast',
    support: {
      getChannelConfig: (path: string) => {
        return broadcastConfig;
      },
      getSupportedPaths: () => [broadcastConfig],
    },
    description: 'Broadcast will send/recieve any JSON object in a channel',
  });

  grafanaLiveCoreFeatures.register({
    name: 'measurements',
    support: new LiveMeasurmentsSupport(),
    description: 'These channels listen for measurements and produce DataFrames',
  });

  // dashboard/*
  grafanaLiveCoreFeatures.register(getDashboardChannelsFeature());
}
