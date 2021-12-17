import { e2e } from '@grafana/e2e';

e2e.benchmark({
  name: 'Live performance benchmarking - 6x20hz panels',
  benchmarkingOptions: {
    dashboardFolder: '/dashboards/live',
    repeat: 5,
    delayAfterOpeningDashboard: 1000,
    duration: 30000,

    appStats: {
      startCollecting: (window) => {
        (window as any).grafanaRuntime?.livePerformance.start();
      },
      collect: (window) => {
        const stats: Record<string, unknown[]> = (window as any).grafanaRuntime?.livePerformance.getStats();
        return stats ? stats : {};
      },
    },
  },
});
