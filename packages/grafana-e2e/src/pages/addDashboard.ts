import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const AddDashboard = pageFactory({
  url: '/dashboard/new',
  selectors: selectors.pages.AddDashboard,
});
