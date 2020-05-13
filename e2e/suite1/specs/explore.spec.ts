import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Explore',
  itName: 'Basic path through Explore.',
  addScenarioDataSource: true,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.pages.Explore.visit();
    e2e.pages.Explore.General.container().should('have.length', 1);
    e2e.pages.Explore.General.runButton().should('have.length', 1);

    const canvases = e2e().get('canvas');
    canvases.should('have.length', 2);

    e2e.components.DataSource.TestData.QueryTab.noise().should('have.length', 1);
  },
});
