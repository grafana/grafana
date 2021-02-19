import { e2e } from '../index';

export const saveDashboard = () => {
  e2e.pages.Dashboard.Toolbar.toolbarItems('Save dashboard').click();

  e2e.pages.SaveDashboardModal.save().click();

  e2e.flows.assertSuccessNotification();
};
