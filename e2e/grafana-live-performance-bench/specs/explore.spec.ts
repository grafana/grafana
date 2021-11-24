import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Live performance benchmarking',
  itName: 'collects data about the performance of Grafana Live',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.importDashboards('/dashboards', 1000);

    e2e.flows.openDashboard();
    e2e().wait(5000);

    e2e().startProfiling();
    e2e().wait(20000);

    e2e().stopProfiling();
  },
});
