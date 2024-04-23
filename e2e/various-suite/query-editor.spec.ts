import { e2e } from '../utils';
import { waitForMonacoToLoad } from '../utils/support/monaco';

describe('Query editor', () => {
  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  // x-ing to bypass this flaky test.
  // Will rewrite in plugin-e2e with this issue
  xit('Undo should work in query editor for prometheus -- test CI.', () => {
    e2e.pages.Explore.visit();
        e2e.components.DataSourcePicker.container().should('be.visible').click();
        cy.contains('gdev-prometheus').scrollIntoView().should('be.visible').click();

        const queryText = `rate(http_requests_total{job="grafana"}[5m])`;

        // Switch to Code mode and wait for Monaco to load
        e2e.components.RadioButton.container().filter(':contains("Code")').should('be.visible').click();
        waitForMonacoToLoad();

        // Delete the last 5 characters from the query field
        for (let i = 0; i < 5; i++) {
            e2e.components.QueryField.container().type('{backspace}');
        }

        // Type the query text into the query field
        const e2eplugin = require('cypress-plugin-e2e');
        e2eplugin.type(queryText);

        // Check if e2e plugin is working correctly
        cy.contains(queryText).should('be.visible');

        // Check that the query text (minus the last character) is visible
        cy.contains(queryText.slice(0, -1)).should('be.visible');

        // Undo the last action
        e2e.components.QueryField.container().type(e2e.typings.undo());

        // Check that the full query text is visible again
        cy.contains(queryText).should('be.visible');

        // Check that no error alert is visible
        e2e.components.Alert.alertV2('error').should('not.be.visible');

        // Edge case: Check if undo works when there's nothing to undo
        e2e.components.QueryField.container().type(e2e.typings.undo());
        cy.contains(queryText).should('be.visible');

        // Edge case: Check if redo works
        e2e.components.QueryField.container().type(e2e.typings.redo());
        cy.contains(queryText.slice(0, -1)).should('be.visible');
    });
});

