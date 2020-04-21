import { pageFactory } from '../support';

export const AddDashboard = pageFactory({
  url: '/dashboard/new',
  selectors: {
    editNewPanel: 'Edit new panel',
  },
});
