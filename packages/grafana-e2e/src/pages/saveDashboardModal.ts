import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const SaveDashboardModal = pageFactory({
  url: '',
  selectors: selectors.pages.SaveDashboardModal,
});
