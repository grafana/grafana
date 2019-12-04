import { Pages } from '../pages';
import { Flows } from './index';

export const saveDashboard = () => {
  Pages.Dashboard.toolbarItems('Save dashboard').click();

  Pages.SaveDashboardModal.save().click();

  Flows.assertSuccessNotification();
};
