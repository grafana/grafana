import { Pages } from '../pages';
import { Flows } from './index';
import { Url } from '../support/url';

export const addDashboard = async (): Promise<{ dashboardTitle: string; uid: string }> => {
  Pages.AddDashboard.visit();

  Pages.Dashboard.toolbarItems('Save dashboard').click();

  const dashboardTitle = `e2e-${new Date().getTime()}`;
  Pages.SaveAsModal.newName().clear();
  Pages.SaveAsModal.newName().type(dashboardTitle);
  Pages.SaveAsModal.save().click();

  Flows.assertSuccessNotification();

  return new Promise(resolve => {
    cy.url().then(url => {
      resolve({
        dashboardTitle,
        uid: Url.getDashboardUid(url),
      });
    });
  });
};
