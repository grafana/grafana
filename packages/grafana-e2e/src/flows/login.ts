import { Pages } from '../index';

export const login = (username: string, password: string) => {
  Pages.Login.visit();
  Pages.Login.username().type(username);
  Pages.Login.password().type(password);
  Pages.Login.submit().click();
};
