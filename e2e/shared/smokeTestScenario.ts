import { e2e } from '@grafana/e2e';

export const smokeTestScenario = {
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  loginViaApi: false,
  scenario: () => {
    // wait for time to be set to account for any layout shift
    e2e().contains('2020-01-01 00:00:00 to 2020-01-01 06:00:00').should('be.visible');
    e2e.components.PageToolbar.itemButton('Add button').click();
    e2e.components.PageToolbar.itemButton('Add new visualization menu item').click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .should('be.visible')
      .within(() => {
        e2e().get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

    // Make sure the graph renders via checking legend
    e2e.components.VizLegend.seriesName('A-series').should('be.visible');

    // Expand options section
    e2e.components.PanelEditor.applyButton();

    // Make sure panel is & visualization is added to dashboard
    e2e.components.VizLegend.seriesName('A-series').should('be.visible');
  },
};
