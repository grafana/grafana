import { pageFactory } from '../support';

export const DashboardSettings = pageFactory({
  url: '',
  selectors: {
    deleteDashBoard: 'Dashboard settings page delete dashboard button',
    sectionItems: 'Dashboard settings section item',
    saveDashBoard: 'Dashboard settings aside actions Save button',
    saveAsDashBoard: 'Dashboard settings aside actions Save As button',
  },
});
