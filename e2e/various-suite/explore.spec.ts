import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Explore',
  itName: 'Basic path through Explore.',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.pages.Explore.visit();
    e2e.pages.Explore.General.container().should('have.length', 1);
    e2e.components.RefreshPicker.runButtonV2().should('have.length', 1);

    // delete query history queries that would be unrelated
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();
    cy.get('button[title="Delete query"]').each((button) => {
      button.trigger('click');
    });
    cy.get('button[title="Delete query"]').should('not.exist');
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        e2e().get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

    const canvases = e2e().get('canvas');
    canvases.should('have.length', 1);

    // Both queries above should have been run and be shown in the query history
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();
    e2e.components.QueryHistory.queryText().should('have.length', 1).should('contain', 'csv_metric_values');

    // delete all queries
    cy.get('button[title="Delete query"]').each((button) => {
      button.trigger('click');
    });
  },
});
