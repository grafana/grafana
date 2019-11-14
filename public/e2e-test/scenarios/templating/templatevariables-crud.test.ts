import { e2eScenario } from '@grafana/toolkit/src/e2e';
import { Browser, Page } from 'puppeteer-core';
import { createDashboardPage } from '../../pages/dashboards/createDashboardPage';
import { dashboardPage } from '../../pages/dashboards/dashboardPage';
import { dashboardSettingsPage } from '../../pages/dashboards/dashboardSettingsPage';
import { variablesPage } from '../../pages/templating/variablesPage';

e2eScenario({
  describeName: 'Template Variables tests',
  itName: 'Template Variables CRUD',
  scenario: async (browser: Browser, page: Page) => {
    await createDashboardPage.init(page);
    await createDashboardPage.navigateTo();

    await dashboardPage.init(page);
    await dashboardPage.pageObjects.settings.click();

    await dashboardSettingsPage.init(page);
    await dashboardSettingsPage.pageObjects.variablesSection.click();

    await variablesPage.init(page);
    await variablesPage.pageObjects.callToActionButton.exists();
    await variablesPage.pageObjects.callToActionButton.click();
  },
});
