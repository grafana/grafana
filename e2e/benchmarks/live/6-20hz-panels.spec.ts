import { e2e } from '@grafana/e2e';

e2e.benchmark({
  name: 'Live performance benchmarking - 6x20hz panels',
  benchmarkingOptions: {
    dashboardFolder: '/dashboards/live',
    repeat: 5,
    delayAfterOpeningDashboard: 1000,
    duration: 30000,
  },
});
