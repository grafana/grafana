import { e2e } from '../index';

export const login = (username: string = 'admin', password: string = 'admin') => {
  e2e().logToConsole('Logging in with username:', username);
  e2e.pages.Login.visit();
  e2e.pages.Login.username()
    .should('be.visible') // prevents flakiness
    .type(username);
  e2e.pages.Login.password().type(password);
  e2e.pages.Login.submit().click();

  // Local tests will have insecure credentials
  e2e()
    .url()
    .then(url => {
      if (/^https?:\/\/localhost/.test(url)) {
        e2e.pages.Login.skip()
          .should('be.visible')
          .click();
      }
    });

  e2e()
    .get('.login-page')
    .should('not.exist');
  e2e().logToConsole('Logged in with username:', username);
};
