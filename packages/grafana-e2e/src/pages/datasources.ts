import { pageFactory } from '../support';
import { Selectors } from '../selectors';

export const DataSources = pageFactory({
  url: '/datasources',
  selectors: Selectors.DataSources,
});
