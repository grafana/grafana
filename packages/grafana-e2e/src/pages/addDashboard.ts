import { pageFactory } from '../support';

export const AddDashboard = pageFactory({
  url: '/dashboard/new',
  selectors: {
    addNewPanel: 'Add new panel',
  },
});
