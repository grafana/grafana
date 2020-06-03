import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export const deleteDashboard = (uid: string) => {
  e2e().logToConsole('Deleting dashboard with uid:', uid);
  e2e().request('DELETE', fromBaseUrl(`/api/dashboards/uid/${uid}`));

  /* https://github.com/cypress-io/cypress/issues/2831
  Flows.openDashboard(title);

  Pages.Dashboard.settings().click();

  Pages.DashboardSettings.deleteDashBoard().click();

  Pages.ConfirmModal.delete().click();

  Flows.assertSuccessNotification();

  Pages.Dashboards.visit();
  Pages.Dashboards.dashboards().each(item => {
    const text = item.text();
    Cypress.log({ message: [text] });
    if (text && text.indexOf(title) !== -1) {
      expect(false).equals(true, `Dashboard ${title} was found although it was deleted.`);
    }
  });
  */
};
