import { Pages } from '../index';

export const login = (username: string, password: string) => {
  Pages.Login.visit();
  Pages.Login.pageObjects()
    .username()
    .type(username);
  Pages.Login.pageObjects()
    .password()
    .type(password);
  Pages.Login.pageObjects()
    .submit()
    .click();
};
