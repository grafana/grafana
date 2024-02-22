import { e2e } from '../utils';
import { waitForMonacoToLoad } from '../utils/support/monaco';

describe('Query editor', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  it('Undo should work in query editor for prometheus -- test CI.', () => {
    e2e.pages.Explore.visit();
    e2e.components.DataSourcePicker.container().should('be.visible').click();

    cy.contains('gdev-prometheus').scrollIntoView().should('be.visible').click();
    const queryText = `rate(http_requests_total{job="grafana"}[5m])`;

    e2e.components.RadioButton.container().filter(':contains("Code")').click();

    waitForMonacoToLoad();

    e2e.components.QueryField.container().type(queryText, { parseSpecialCharSequences: false }).type('{backspace}');

    cy.contains(queryText.slice(0, -1)).should('be.visible');

    e2e.components.QueryField.container().type(e2e.typings.undo());

    cy.contains(queryText).should('be.visible');

    e2e.components.Alert.alertV2('error').should('not.be.visible');
  });
});
