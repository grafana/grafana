import { Flows, Pages } from '../index';

export const deleteDashboard = (dashboardName: string) => {
  Pages.Dashboards.visit();
  Pages.Dashboards.dashboards()
    .contains(dashboardName)
    .click();

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
};
