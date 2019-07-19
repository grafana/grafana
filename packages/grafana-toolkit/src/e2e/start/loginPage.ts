import { TestPage } from '../pages';
import {
  Selector,
  InputPageObject,
  InputPageObjectType,
  ClickablePageObjectType,
  ClickablePageObject,
} from '../pageObjects';

export interface LoginPage {
  username: InputPageObjectType;
  password: InputPageObjectType;
  submit: ClickablePageObjectType;
}

export const loginPage = new TestPage<LoginPage>({
  url: '/login',
  pageObjects: {
    username: new InputPageObject(Selector.fromAriaLabel('Username input field')),
    password: new InputPageObject(Selector.fromAriaLabel('Password input field')),
    submit: new ClickablePageObject(Selector.fromAriaLabel('Login button')),
  },
});
