import { e2e } from '../index';
import { fromBaseUrl, getDashboardUid } from '../support/url';

import { DeleteDashboardConfig } from '.';

type Panel = {
  title: string;
  [key: string]: unknown;
};

export type Dashboard = { title: string; panels: Panel[]; uid: string; [key: string]: unknown };

/**
 * Smoke test a particular dashboard by quickly importing a json file and validate that all the panels finish loading
 * @param dashboardToImport a sample dashboard
 * @param queryTimeout a number of ms to wait for the imported dashboard to finish loading
 * @param skipPanelValidation skip panel validation
 */
export const importDashboard = (dashboardToImport: Dashboard, queryTimeout?: number, skipPanelValidation?: boolean) => {
  e2e().visit(fromBaseUrl('/dashboard/import'));

  // Note: normally we'd use 'click' and then 'type' here, but the json object is so big that using 'val' is much faster
  e2e.components.DashboardImportPage.textarea().should('be.visible');
  e2e.components.DashboardImportPage.textarea().click();
  e2e.components.DashboardImportPage.textarea().invoke('val', JSON.stringify(dashboardToImport));
  e2e.components.DashboardImportPage.submit().should('be.visible').click();
  e2e.components.ImportDashboardForm.name().should('be.visible').click().clear().type(dashboardToImport.title);
  e2e.components.ImportDashboardForm.submit().should('be.visible').click();

  // wait for dashboard to load
  e2e().wait(queryTimeout || 6000);

  // save the newly imported dashboard to context so it'll get properly deleted later
  e2e()
    .url()
    .should('contain', '/d/')
    .then((url: string) => {
      const uid = getDashboardUid(url);

      e2e.getScenarioContext().then(({ addedDashboards }: { addedDashboards: DeleteDashboardConfig[] }) => {
        e2e.setScenarioContext({
          addedDashboards: [...addedDashboards, { title: dashboardToImport.title, uid }],
        });
      });

      expect(dashboardToImport.uid).to.equal(uid);
    });

  if (!skipPanelValidation) {
    dashboardToImport.panels.forEach((panel) => {
      // Look at the json data
      e2e.components.Panels.Panel.menu(panel.title).click({ force: true }); // force click because menu is hidden and show on hover
      e2e.components.Panels.Panel.menuItems('Inspect').should('be.visible').click();
      e2e.components.Tab.title('JSON').should('be.visible').click();
      e2e.components.PanelInspector.Json.content().should('be.visible').contains('Panel JSON').click({ force: true });
      e2e.components.Select.option().should('be.visible').contains('Panel data').click();

      // ensures that panel has loaded without knowingly hitting an error
      // note: this does not prove that data came back as we expected it,
      // it could get `state: Done` for no data for example
      // but it ensures we didn't hit a 401 or 500 or something like that
      e2e.components.CodeEditor.container()
        .should('be.visible')
        .contains(/"state": "(Done|Streaming)"/);

      // need to close panel
      e2e.components.Drawer.General.close().click();
    });
  }
};
