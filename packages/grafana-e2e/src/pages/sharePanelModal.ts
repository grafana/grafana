import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const SharePanelModal = pageFactory({
  url: '',
  selectors: selectors.pages.SharePanelModal,
});
