import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Query editor',
  itName: 'Undo should work in query editor for prometheus.',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.inputV2().should('be.visible').click();

    cy.contains('gdev-prometheus').scrollIntoView().should('be.visible').click();
    const queryText = 'http_requests_total';

    // we need to wait for the query-field being lazy-loaded, in two steps:
    // it is a two-step process:
    // 1. first we wait for the text 'Loading...' to appear
    // 1. then we wait for the text 'Loading...' to disappear
    const monacoLoadingText = 'Loading...';
    e2e.components.QueryField.container().should('be.visible').should('have.text', monacoLoadingText);
    e2e.components.QueryField.container().should('be.visible').should('not.have.text', monacoLoadingText);

    e2e.components.QueryField.container().type(queryText).type('{backspace}');

    cy.contains(queryText.slice(0, -1)).should('be.visible');

    e2e.components.QueryField.container().type(e2e.typings.undo());

    cy.contains(queryText).should('be.visible');
  },
});
