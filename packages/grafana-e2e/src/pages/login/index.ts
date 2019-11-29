import { pageFactory } from '../../support';
import { Selectors } from '../../selectors';

const Page = pageFactory({
  url: '/login',
  selectors: Selectors.Login,
});

export const Login = { Page };
