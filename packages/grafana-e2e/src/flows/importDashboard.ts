import { DeleteDashboardConfig } from '.';
import { e2e } from '../index';
import { fromBaseUrl, getDashboardUid } from '../support/url';

type Panel = {
  title: string;
  [key: string]: unknown;
};

type Dashboard = { title: string; panels: Panel[]; [key: string]: unknown };

/**
 * Smoke test a datasource by quickly importing a test dashboard for it
 * @param dashboardToImport a sample dashboard
 */
export const importDashboard = (dashboardToImport: Dashboard) => {
  e2e().visit(fromBaseUrl('/dashboard/import'));

  // Note: normally we'd use 'click' and then 'type' here, but the json object is so big that using 'val' is much faster
  e2e.components.DashboardImportPage.textarea().click({ force: true }).invoke('val', JSON.stringify(dashboardToImport));
  e2e.components.DashboardImportPage.submit().click({ force: true });
  e2e.components.ImportDashboardForm.name().click({ force: true }).clear().type(dashboardToImport.title);
  e2e.components.ImportDashboardForm.submit().click({ force: true });
  e2e().wait(3000);

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
    });

  // inspect first panel and verify data has been processed for it
  e2e.components.Panels.Panel.title(dashboardToImport.panels[0].title).click({ force: true });
  e2e.components.Panels.Panel.headerItems('Inspect').click({ force: true });
  e2e.components.Tab.title('JSON').click({ force: true });
  e2e().wait(3000);
  e2e.components.PanelInspector.Json.content().contains('Panel JSON').click({ force: true });
  e2e().wait(3000);
  e2e.components.Select.option().contains('Data').click({ force: true });
  e2e().wait(3000);

  // ensures that panel has loaded without knowingly hitting an error
  // note: this does not prove that data came back as we expected it,
  // it could get `state: Done` for no data for example
  // but it ensures we didn't hit a 401 or 500 or something like that
  e2e.components.CodeEditor.container().contains('"state": "Done"');
};
