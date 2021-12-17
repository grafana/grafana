import { e2e } from '@grafana/e2e';

type WithGrafanaRuntime<T> = T & {
  grafanaRuntime: {
    livePerformance: {
      start: () => void;
      getStats: () => Record<string, unknown>;
    };
  };
};

const hasGrafanaRuntime = <T>(obj: T): obj is WithGrafanaRuntime<T> => {
  return typeof (obj as any)?.grafanaRuntime === 'object';
};

e2e.benchmark({
  name: 'Live performance benchmarking - 6x20hz panels',
  benchmarkingOptions: {
    dashboardFolder: '/dashboards/live',
    repeat: 5,
    delayAfterOpeningDashboard: 1000,
    duration: 30000,

    appStats: {
      startCollecting: (window) => {
        if (!hasGrafanaRuntime(window)) {
          return;
        }

        return window.grafanaRuntime.livePerformance.start();
      },
      collect: (window) => {
        if (!hasGrafanaRuntime(window)) {
          return {};
        }

        return window.grafanaRuntime.livePerformance.getStats() ?? {};
      },
    },
  },
});
