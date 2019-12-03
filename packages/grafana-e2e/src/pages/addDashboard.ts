import { pageFactory } from '../support';
import { Selectors } from '../selectors';

export const AddDashboard = pageFactory({
  url: '/dashboard/new',
  selectors: Selectors.AddDashboard,
});
