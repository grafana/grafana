import { e2e } from '@grafana/e2e';

export const smokeTestScenario = {
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard();
    e2e.components.PageToolbar.item('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input().should('be.visible').click();
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
