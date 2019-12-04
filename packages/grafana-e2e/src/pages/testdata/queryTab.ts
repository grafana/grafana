import { pageFactory } from '../../support';
import { Selectors } from '../../selectors';

export const QueryTab = pageFactory({
  url: '',
  selectors: Selectors.Panels.DataSource.TestData.QueryTab,
});
