import { pageFactory } from '../support';

export const SaveDashboardAsModal = pageFactory({
  url: '',
  selectors: {
    newName: 'Save dashboard title field',
    save: 'Save dashboard button',
  },
});
