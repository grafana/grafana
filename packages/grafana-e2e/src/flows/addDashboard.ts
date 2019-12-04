import { Pages } from '../pages';
import { Flows } from './index';
import { Url } from '../support/url';

export const addDashboard = async (): Promise<{ dashboardTitle: string; uid: string }> => {
  Pages.AddDashboard.visit();

  const dashboardTitle = Flows.saveNewDashboard();

  return new Promise(resolve => {
    cy.url().then(url => {
      resolve({
        dashboardTitle,
        uid: Url.getDashboardUid(url),
      });
    });
  });
};
