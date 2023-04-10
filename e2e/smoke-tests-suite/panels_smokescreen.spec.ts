import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Panel edit panels smokescreen',
  itName: 'Tests each panel type in the panel edit view to ensure no crash',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.flows.addDashboard({
      title: 'e2e-panels-smokescreen',
    });
  },
});
