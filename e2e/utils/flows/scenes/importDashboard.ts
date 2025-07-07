import { e2e } from '../..';
import testV2Dashboard from '../../../dashboards/TestV2Dashboard.json';

export interface ImportDashboardConfig {
  title?: string;
}

export const importV2Dashboard = ({ title }: ImportDashboardConfig) => {
  e2e.pages.ImportDashboard.visit();
  e2e.components.DashboardImportPage.textarea().type(JSON.stringify(testV2Dashboard), {
    delay: 0,
    parseSpecialCharSequences: false,
  });

  e2e.components.DashboardImportPage.submit().click();

  if (title) {
    e2e.components.ImportDashboardForm.name().clear().type(title);
  }

  e2e.components.DataSourcePicker.inputV2().click();
  cy.get('div[data-testid="data-source-card"]').first().click();

  e2e.components.ImportDashboardForm.submit().click();
};
