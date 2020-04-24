import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const Dashboards = pageFactory({
  url: '/dashboards',
  selectors: selectors.pages.Dashboards,
});
