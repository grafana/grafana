import { LiveChannelType } from '@grafana/data';
import { getDashboardChannelsFeature } from './dashboard/dashboardWatcher';
import { grafanaLiveCoreFeatures } from './scopes';

export function registerLiveFeatures() {
  grafanaLiveCoreFeatures.register({
    name: 'testdata',
    support: {
      getChannelConfig: (path: string) => {
        return {
          type: LiveChannelType.DataStream,
        };
      },
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
    },
    description: 'Broadcast will send/receive any JSON object in a channel',
  });

  // dashboard/*
  grafanaLiveCoreFeatures.register(getDashboardChannelsFeature());
}
