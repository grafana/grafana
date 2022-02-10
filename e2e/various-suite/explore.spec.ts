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

    cy.location().then((loc) => {
      const parsedUrl = e2e.utils.parseKeyValue(loc.search);
      const leftJSON = JSON.parse(parsedUrl.left);
      expect(leftJSON.range.to).to.equal('now');
      expect(leftJSON.range.from).to.equal('now-1h');

      cy.get('body').click();
      cy.get('body').type('t{leftarrow}');

      cy.location().then((locPostKeypress) => {
        const parsedUrl = e2e.utils.parseKeyValue(locPostKeypress.search);
        const leftJSON = JSON.parse(parsedUrl.left);
        // be sure the keypress affected the time window
        expect(leftJSON.range.to).to.not.equal('now');
        expect(leftJSON.range.from).to.not.equal('now-1h');
        // be sure the url does not contain dashboard range values
        expect(parsedUrl).to.not.have.keys('to', 'from');
      });
    });

    const canvases = e2e().get('canvas');
    canvases.should('have.length', 1);
  },
});
