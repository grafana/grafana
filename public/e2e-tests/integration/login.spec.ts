import { e2eScenario } from '@grafana/e2e';

e2eScenario({
  describeName: 'Login',
  itName: 'Should pass',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: scenarioDataSourceName => {},
});
