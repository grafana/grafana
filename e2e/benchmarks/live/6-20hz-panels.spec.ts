import { e2e } from '@grafana/e2e';

e2e.benchmark({
  name: 'Live performance benchmarking - 6x20hz panels',
  benchmarkingOptions: {
    dashboardFolder: '/dashboards/live',
    repeat: 5,
    delayAfterOpeningDashboard: 1000,
    duration: 30000,
    collectAppStats: (window) => {
      const stats: Record<string, unknown[]> = (window as any).grafanaRuntime?.getLivePerformanceStats();
      if (!stats) {
        return {};
      }

      // TODO collect all, not just last
      return Object.fromEntries(
        Object.entries(stats)
          .filter(([_, val]) => Array.isArray(val) && val.length)
          .map(([name, val]) => [name, val[val.length - 1]])
      );
    },
  },
});
