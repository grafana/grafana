import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const ConfirmModal = pageFactory({
  url: '',
  selectors: selectors.pages.ConfirmModal,
});
