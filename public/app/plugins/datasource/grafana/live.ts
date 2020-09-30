import { LiveChannelConfig, LiveChannelSupport } from '@grafana/data';

// This all exists under: grafana/metrics/${path}
export const liveMetrics: LiveChannelConfig[] = [
  // Needs to match the backend support
  { path: 'live', description: 'stats about the websocket server' },
];

export const grafanaLiveMetrics: LiveChannelSupport = {
  getChannelConfig: (path: string) => {
    return liveMetrics.find(v => v.path === path);
  },
  getSupportedPaths: () => liveMetrics,
};
