import { e2e } from '../index';

export const login = (username: string, password: string) => {
  e2e.pages.Login.visit();
  e2e.pages.Login.username().type(username);
  e2e.pages.Login.password().type(password);
  e2e.pages.Login.submit().click();
};
