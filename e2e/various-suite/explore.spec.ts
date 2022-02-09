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

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .should('be.visible')
      .within(() => {
        e2e().get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

    const canvases = e2e().get('canvas');
    canvases.should('have.length', 1);
  },
});
