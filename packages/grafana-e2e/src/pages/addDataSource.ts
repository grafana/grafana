import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const AddDataSource = pageFactory({
  url: '/datasources/new',
  selectors: selectors.pages.AddDataSource,
});
