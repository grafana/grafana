import { pageFactory } from '../../support';

const Selectors = {
  username: 'Username input field',
  password: 'Password input field',
  submit: 'Login button',
};

const Page = pageFactory({
  url: '/login',
  selectors: Selectors,
});

export const Login = { Page, Selectors };
