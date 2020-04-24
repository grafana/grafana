import { pageFactory } from '../support';
import { selectors } from '@grafana/e2e-selectors';

export const DataSources = pageFactory({
  url: '/datasources',
  selectors: selectors.pages.DataSources,
});
