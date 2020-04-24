import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const Login = pageFactory({
  url: '/login',
  selectors: selectors.pages.Login,
});
