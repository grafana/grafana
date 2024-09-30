import { e2e } from '../utils';

export const smokeTestScenario = () =>
  describe('Smoke tests', () => {
    before(() => {
      cy.logToConsole('disabling dashboardScene feature toggle in localstorage');
      cy.setLocalStorage('grafana.featureToggles', 'dashboardScene=false');
      cy.reload();
      e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'), false);
      e2e.flows.addDataSource();
      e2e.flows.addDashboard();
    });

    after(() => {
      e2e.flows.revertAllChanges();
    });

    it('Login scenario, create test data source, dashboard, panel, and export scenario', () => {
      // wait for time to be set to account for any layout shift
      cy.contains('2020-01-01 00:00:00 to 2020-01-01 06:00:00').should('be.visible');
      e2e.components.PageToolbar.itemButton('Add button').click();
      e2e.components.PageToolbar.itemButton('Add new visualization menu item').click();

      e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
        .should('be.visible')
        .within(() => {
          cy.get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
        });

      cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

      // Make sure the graph renders via checking legend
      e2e.components.VizLegend.seriesName('A-series').should('be.visible');

      // Expand options section
      e2e.components.PanelEditor.applyButton();

      // Make sure panel is & visualization is added to dashboard
      e2e.components.VizLegend.seriesName('A-series').should('be.visible');
    });
  });
