import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const SaveDashboardAsModal = pageFactory({
  url: '',
  selectors: selectors.pages.SaveDashboardAsModal,
});
