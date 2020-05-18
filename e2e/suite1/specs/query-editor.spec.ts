import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Query editor',
  itName: 'Undo should work in query editor for prometheus.',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container()
      .should('be.visible')
      .within(() => {
        e2e.components.Select.input()
          .should('be.visible')
          .click();

        cy.contains('gdev-prometheus')
          .scrollIntoView()
          .should('be.visible')
          .click();
      });
    const queryText = 'http_requests_total';

    e2e.components.QueryField.container()
      .should('be.visible')
      .type(queryText)
      .type('{backspace}');

    cy.contains(queryText.slice(0, -1)).should('be.visible');

    e2e.components.QueryField.container().type('{ctrl}z');

    cy.contains(queryText).should('be.visible');
  },
});
