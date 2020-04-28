import { e2e } from '../index';
import { getDashboardUid } from '../support/url';

export const addDashboard = () => {
  e2e().logToConsole('Adding dashboard');
  e2e.pages.AddDashboard.visit();

  const dashboardTitle = e2e.flows.saveNewDashboard();
  e2e().logToConsole('Added dashboard with title:', dashboardTitle);

  e2e()
    .url()
    .then((url: string) => {
      e2e.setScenarioContext({
        lastAddedDashboard: dashboardTitle,
        lastAddedDashboardUid: getDashboardUid(url),
      });
    });
};
