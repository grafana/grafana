import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const Explore = pageFactory({
  url: '/explore',
  selectors: selectors.pages.Explore.General,
});
