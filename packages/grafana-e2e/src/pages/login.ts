import { pageFactory } from '../support';
import { Selectors } from '../selectors';

export const Login = pageFactory({
  url: '/login',
  selectors: Selectors.Login,
});
