import {
  InputPageObject,
  ClickablePageObject,
  Selector,
  InputPageObjectType,
  ClickablePageObjectType,
} from 'e2e-test/core/pageObjects';
import { TestPage } from 'e2e-test/core/pages';

export interface LoginPage {
  username: InputPageObjectType;
  password: InputPageObjectType;
  submit: ClickablePageObjectType;
}

export const loginPage = new TestPage<LoginPage>({
  url: '/login',
  pageObjects: {
    username: new InputPageObject(Selector.fromAriaLabel('username')),
    password: new InputPageObject(Selector.fromAriaLabel('password')),
    submit: new ClickablePageObject(Selector.fromAriaLabel('login button')),
  },
});
