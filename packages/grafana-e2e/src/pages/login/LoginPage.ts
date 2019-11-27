import { Page, Selectors } from '../../support';

export interface LoginPageSelectors extends Selectors {
  username: string;
  password: string;
  submit: string;
}

export class LoginPage extends Page<LoginPageSelectors> {
  url = '/login';
  selectors = {
    username: 'Username input field',
    password: 'Password input field',
    submit: 'Login button',
  };

  login(username: string, password: string) {
    this.pageObjects.username().type(username);
    this.pageObjects.password().type(password);
    this.pageObjects.submit().click();
  }
}
