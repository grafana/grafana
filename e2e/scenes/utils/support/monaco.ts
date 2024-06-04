import { e2e } from '../index';

export function waitForMonacoToLoad() {
  e2e.components.QueryField.container().children('[data-testid="Spinner"]').should('not.exist');
  cy.window().its('monaco').should('exist');
  cy.get('.monaco-editor textarea:first').should('exist');
}
