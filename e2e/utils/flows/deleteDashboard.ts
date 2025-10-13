import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export interface DeleteDashboardConfig {
  quick?: boolean;
  title: string;
  uid: string;
}

export const deleteDashboard = ({ quick = false, title, uid }: DeleteDashboardConfig) => {
  cy.logToConsole('Deleting dashboard with uid:', uid);

  if (quick) {
    quickDelete(uid);
  } else {
    uiDelete(uid, title);
  }

  cy.logToConsole('Deleted dashboard with uid:', uid);

  e2e.getScenarioContext().then(({ addedDashboards }) => {
    e2e.setScenarioContext({
      addedDashboards: addedDashboards.filter((dashboard: DeleteDashboardConfig) => {
        return dashboard.title !== title && dashboard.uid !== uid;
      }),
    });
  });
};

const quickDelete = (uid: string) => {
  cy.request('DELETE', fromBaseUrl(`/api/dashboards/uid/${uid}`));
};

const uiDelete = (uid: string, title: string) => {
  e2e.pages.Dashboard.visit(uid);
  e2e.components.PageToolbar.item('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.deleteDashBoard().click();
  e2e.pages.ConfirmModal.delete().click();
  e2e.flows.assertSuccessNotification();

  e2e.pages.Dashboards.visit();

  // @todo replace `e2e.pages.Dashboards.dashboards` with this when argument is empty
  if (e2e.components.Search.dashboardItems) {
    e2e.components.Search.dashboardItems().each((item) => cy.wrap(item).should('not.contain', title));
  } else {
    cy.get('[aria-label^="Dashboard search item "]').each((item) => cy.wrap(item).should('not.contain', title));
  }
};
