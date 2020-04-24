import { selectors } from '@grafana/e2e-selectors';

import { componentFactory } from '../../support';

export const QueryTab = componentFactory({
  selectors: selectors.components.DataSource.TestData.QueryTab,
});
