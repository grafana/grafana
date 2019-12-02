import { pageFactory } from '../support';
import { Selectors } from '../selectors';

export const AddDataSource = pageFactory({
  url: '/datasources/new',
  selectors: Selectors.AddDataSource,
});
