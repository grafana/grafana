import { pageFactory } from '../support';
import { selectors } from '@grafana/e2e-selectors';

export const DashboardSettings = pageFactory({
  url: '',
  selectors: selectors.pages.Dashboard.Settings.General,
});
