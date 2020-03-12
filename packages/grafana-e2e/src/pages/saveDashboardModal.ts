import { pageFactory } from '../support';

export const SaveDashboardModal = pageFactory({
  url: '',
  selectors: {
    save: 'Dashboard settings Save Dashboard Modal Save button',
    saveVariables: 'Dashboard settings Save Dashboard Modal Save variables checkbox',
    saveTimerange: 'Dashboard settings Save Dashboard Modal Save timerange checkbox',
  },
});
