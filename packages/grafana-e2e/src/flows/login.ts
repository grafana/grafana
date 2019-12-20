import { e2e } from '../index';

export const login = (username: string, password: string) => {
  e2e().logToConsole('Trying to login with:', { username, password });
  e2e.pages.Login.visit();
  e2e.pages.Login.username()
    .should('be.visible') // prevents flakiness
    .type(username);
  e2e.pages.Login.password().type(password);
  e2e.pages.Login.submit().click();
  e2e.pages.Login.skip()
    .should('be.visible')
    .click();
  e2e()
    .get('.login-page')
    .should('not.exist');
  e2e().logToConsole('Logged in with', { username, password });
};
