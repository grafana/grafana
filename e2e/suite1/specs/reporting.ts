import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Reporting',
  itName: 'Create report',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.pages.NewReport.visit();
    e2e.components.Reporting.pageHeader().should('be.visible');
    e2e().get('input[name="name"]').should('be.visible').type('Test report');
  },
});
