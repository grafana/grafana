import { selectors } from '@grafana/e2e-selectors';
import { pageFactory } from '../support';

export const Panel = pageFactory({
  url: '',
  selectors: selectors.components.Panels.Panel,
});
