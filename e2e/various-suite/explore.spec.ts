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
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();

    e2e.components.DataSource.TestData.QueryTab.scenarioSelectContainer()
      .scrollIntoView()
      .should('be.visible')
      .within(() => {
        e2e().get('input[id*="test-data-scenario-select-"]').should('be.visible').click();
      });

    cy.contains('CSV Metric Values').scrollIntoView().should('be.visible').click();

    cy.location().then((loc) => {
      const params = new URLSearchParams(loc.search);
      const leftJSON = JSON.parse(params.get('left'));
      expect(leftJSON.range.to).to.equal('now');
      expect(leftJSON.range.from).to.equal('now-1h');

      cy.get('body').click();
      cy.get('body').type('t{leftarrow}');

      cy.location().then((locPostKeypress) => {
        const params = new URLSearchParams(locPostKeypress.search);
        const leftJSON = JSON.parse(params.get('left'));
        // be sure the keypress affected the time window
        expect(leftJSON.range.to).to.not.equal('now');
        expect(leftJSON.range.from).to.not.equal('now-1h');
        // be sure the url does not contain dashboard range values
        // eslint wants this to be a function, so we use this instead of to.be.false
        expect(params.has('to')).to.equal(false);
        expect(params.has('from')).to.equal(false);
      });
    });

    const canvases = e2e().get('canvas');
    canvases.should('have.length', 1);

    // Both queries above should have been run and be shown in the query history
    e2e.components.QueryTab.queryHistoryButton().should('be.visible').click();
    e2e.components.QueryHistory.queryText().should('have.length', 2).should('contain', 'csv_metric_values');

    // delete all queries
    cy.get('button[title="Delete query"]').each((button) => {
      button.trigger('click');
    });
  },
});
