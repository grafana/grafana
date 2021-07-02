import { e2e } from '../index';
import { fromBaseUrl } from '../support/url';

export const importDashboard = (dashboardName: string, dashboardToImport: { [key: string]: any }) => {
  e2e().visit(fromBaseUrl('/dashboard/import'));

  // Note: normally we'd use 'click' and then 'type' here, but the json object is so big that using 'val' is much faster
  e2e.components.DashboardImportPage.textarea().invoke('val', JSON.stringify(dashboardToImport)).click({ force: true });
  e2e.components.DashboardImportPage.submit().click({ force: true });
  e2e.components.ImportDashboardForm.name().click({ force: true }).clear().type(dashboardName);
  e2e.components.ImportDashboardForm.submit().click({ force: true });
};
