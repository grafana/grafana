import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../support';

export const Dashboard = pageFactory({
  url: (uid: string) => `/d/${uid}`,
  selectors: selectors.pages.Dashboard.Toolbar,
});
