import { e2e } from '../utils';

export const smokeTestScenario = () =>
  describe('Smoke tests', () => {
    before(() => {
      e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), false);
      e2e.flows.addDataSource();
      e2e.flows.addDashboard();
      e2e.flows.addPanel({
        dataSourceName: 'gdev-testdata',
        visitDashboardAtStart: false,
        timeout: 10000,
      });
    });

    after(() => {
      e2e.flows.revertAllChanges();
    });

    it('Login scenario, create test data source, dashboard, panel, and export scenario', () => {
      e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
        .should('be.visible')
        .within(() => {
          cy.get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
        });

      cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

      // Make sure the graph renders via checking legend
      e2e.components.VizLegend.seriesName('A-series').should('be.visible');

      e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();

      // Make sure panel is & visualization is added to dashboard
      e2e.components.VizLegend.seriesName('A-series').should('be.visible');
    });
  });
