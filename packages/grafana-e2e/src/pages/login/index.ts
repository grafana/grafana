import { pageFactory } from '../../support';

const selectors = {
  username: 'Username input field',
  password: 'Password input field',
  submit: 'Login button',
};

const Page = pageFactory({
  url: '/login',
  selectors,
});

export const Login = { Page, Selectors: selectors };
