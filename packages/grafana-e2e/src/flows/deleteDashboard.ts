import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export interface DeleteDashboardConfig {
  quick?: boolean;
  title: string;
  uid: string;
}

export const deleteDashboard = ({ quick = false, title, uid }: DeleteDashboardConfig) => {
  e2e().logToConsole('Deleting dashboard with uid:', uid);

  if (quick) {
    quickDelete(uid);
  } else {
    uiDelete(uid, title);
  }

  e2e().logToConsole('Deleted dashboard with uid:', uid);

  e2e.getScenarioContext().then(({ addedDashboards }: any) => {
    e2e.setScenarioContext({
      addedDashboards: addedDashboards.filter((dashboard: DeleteDashboardConfig) => {
        return dashboard.title !== title && dashboard.uid !== uid;
      }),
    });
  });
};

const quickDelete = (uid: string) => {
  e2e().request('DELETE', fromBaseUrl(`/api/dashboards/uid/${uid}`));
};

const uiDelete = (uid: string, title: string) => {
  e2e.pages.Dashboard.visit(uid);
  e2e.pages.Dashboard.Toolbar.toolbarItems('Dashboard settings').click();
  e2e.pages.Dashboard.Settings.General.deleteDashBoard().click();
  e2e.pages.ConfirmModal.delete().click();
  e2e.flows.assertSuccessNotification();

  e2e.pages.Dashboards.visit();

  // @todo replace `e2e.pages.Dashboards.dashboards` with this when argument is empty
  e2e()
    .get('[aria-label^="Dashboard search item "]')
    .each(item =>
      e2e()
        .wrap(item)
        .should('not.contain', title)
    );
};
