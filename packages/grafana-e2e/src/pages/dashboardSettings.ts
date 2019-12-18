import { pageFactory } from '../support';

export const DashboardSettings = pageFactory({
  url: '',
  selectors: {
    deleteDashBoard: 'Dashboard settings page delete dashboard button',
    sectionItems: (item: string) => `Dashboard settings section item ${item}`,
    saveDashBoard: 'Dashboard settings aside actions Save button',
    saveAsDashBoard: 'Dashboard settings aside actions Save As button',
  },
});
