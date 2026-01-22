import { selectors } from '@grafana/e2e-selectors';

import { e2e } from '../index';
import { Selector } from '../support';
import { fromBaseUrl } from '../support/url';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin';

const loginApi = (username: string, password: string) => {
  cy.request({
    method: 'POST',
    url: fromBaseUrl('/login'),
    body: {
      user: username,
      password,
    },
  });
};

const loginUi = (username: string, password: string) => {
  cy.logToConsole('Logging in with username:', username);
  e2e.pages.Login.visit();
  e2e.pages.Login.username()
    .should('be.visible') // prevents flakiness
    .type(username);
  e2e.pages.Login.password().type(password);
  e2e.pages.Login.submit().click();
  e2e.pages.Login.submit().should('not.exist');

  // Click the skip button, if it is offered, if we know we used the default password
  if (password === DEFAULT_PASSWORD) {
    cy.get('body').then(($body) => {
      if ($body.find(Selector.fromDataTestId(selectors.pages.Login.skip)).length > 0) {
        cy.logToConsole('Skipping password change for username:', username);
        e2e.pages.Login.skip().should('be.visible').click();
      }
    });
  }

  cy.get('.login-page').should('not.exist');
};

export const login = (username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD, loginViaApi = true) => {
  if (loginViaApi) {
    loginApi(username, password);
  } else {
    loginUi(username, password);
  }
  cy.logToConsole('Logged in with username:', username);
};
