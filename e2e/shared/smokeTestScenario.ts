import { e2e } from '@grafana/e2e';

export const smokeTestScenario = {
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  addScenarioDataSource: true,
  addScenarioDashBoard: true,
  skipScenario: false,
  scenario: () => {
    e2e.flows.openDashboard();
    e2e.pages.Dashboard.Toolbar.toolbarItems('Add panel').click();
    e2e.pages.AddDashboard.addNewPanel().click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input()
          .should('be.visible')
          .click();

        cy.contains('CSV Metric Values')
          .scrollIntoView()
          .should('be.visible')
          .click();
      });

    // Make sure the graph renders via checking legend
    e2e.components.Panels.Visualization.Graph.Legend.legendItemAlias('A-series').should('be.visible');

    // Expand options section
    e2e.components.Panels.Visualization.Graph.VisualizationTab.legendSection().click();

    // Disable legend
    e2e.components.Panels.Visualization.Graph.Legend.showLegendSwitch().click();

    e2e.components.Panels.Visualization.Graph.Legend.legendItemAlias('A-series').should('not.exist');
  },
};
