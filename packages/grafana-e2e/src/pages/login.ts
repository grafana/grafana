import { pageFactory } from '../support';

export const Login = pageFactory({
  url: '/login',
  selectors: {
    username: 'Username input field',
    password: 'Password input field',
    submit: 'Login button',
    skip: 'Skip change password button',
  },
});
