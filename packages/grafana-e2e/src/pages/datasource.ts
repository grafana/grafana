import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const DataSource = pageFactory({
  url: '',
  selectors: selectors.pages.DataSource,
});
