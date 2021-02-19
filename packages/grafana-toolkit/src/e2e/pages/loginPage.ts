import { TestPage } from '../pageInfo';
import { ClickablePageObjectType, InputPageObjectType } from '../pageObjects';

export interface LoginPage {
  username: InputPageObjectType;
  password: InputPageObjectType;
  submit: ClickablePageObjectType;
}

export const loginPage = new TestPage<LoginPage>({
  url: '/login',
  pageObjects: {
    username: 'Username input field',
    password: 'Password input field',
    submit: 'Login button',
  },
});
