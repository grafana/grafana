import { e2e } from '../index';

const DEFAULT_USERNAME = 'admin';
const DEFAULT_PASSWORD = 'admin';

export const login = (username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD, loginViaApi = true) => {
  if (loginViaApi) {
    cy.request({
      method: 'POST',
      url: `${e2e.env('BASE_URL')}/login`,
      body: {
        user: username,
        password,
      },
    });
  } else {
    e2e().logToConsole('Logging in with username:', username);
    e2e.pages.Login.visit();
    e2e.pages.Login.username()
      .should('be.visible') // prevents flakiness
      .type(username);
    e2e.pages.Login.password().type(password);
    e2e.pages.Login.submit().click();

    // Local tests will have insecure credentials
    if (password === DEFAULT_PASSWORD) {
      e2e.pages.Login.skip().should('be.visible').click();
    }

    e2e().get('.login-page').should('not.exist');
  }
  e2e().logToConsole('Logged in with username:', username);
};
