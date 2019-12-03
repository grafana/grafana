import { pageFactory } from '../support';
import { Selectors } from '../selectors';

export const Dashboards = pageFactory({
  url: '/dashboards',
  selectors: Selectors.Dashboards,
});
