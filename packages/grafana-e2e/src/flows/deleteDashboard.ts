import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export const deleteDashboard = (dashBoardUid: string) => {
  e2e().logToConsole('Deleting dashboard with uid:', dashBoardUid);
  e2e().request('DELETE', fromBaseUrl(`/api/dashboards/uid/${dashBoardUid}`));

  /* https://github.com/cypress-io/cypress/issues/2831
  Flows.openDashboard(dashboardName);

  Pages.Dashboard.settings().click();

  Pages.DashboardSettings.deleteDashBoard().click();

  Pages.ConfirmModal.delete().click();

  Flows.assertSuccessNotification();

  Pages.Dashboards.visit();
  Pages.Dashboards.dashboards().each(item => {
    const text = item.text();
    Cypress.log({ message: [text] });
    if (text && text.indexOf(dashboardName) !== -1) {
      expect(false).equals(true, `Dashboard ${dashboardName} was found although it was deleted.`);
    }
  });
 */
};
