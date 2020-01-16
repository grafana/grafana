import { Browser, Page, Target } from 'puppeteer-core';

import { compareScreenShots, constants, e2eScenario, takeScreenShot } from '@grafana/toolkit/src/e2e';
import {
  cleanDashboard,
  createDashboardPage,
  dashboardsPageFactory,
  saveDashboardModal,
} from '@grafana/toolkit/src/e2e/pages';
import { panel } from 'e2e-test/pages/panels/panel';
import { editPanelPage } from 'e2e-test/pages/panels/editPanel';
import { sharePanelModal } from 'e2e-test/pages/panels/sharePanelModal';

export const addDashboardAndSetupTestDataGraph = async (page: Page) => {
  // Create a new Dashboard
  const dashboardTitle = `e2e - Dashboard-${new Date().getTime()}`;
  await createDashboardPage.init(page);
  await createDashboardPage.navigateTo();
  await createDashboardPage.pageObjects.addQuery.click();

  await editPanelPage.init(page);
  await editPanelPage.waitForNavigation();
  await editPanelPage.pageObjects.queriesTab.click();
  await editPanelPage.pageObjects.scenarioSelect.select('string:csv_metric_values');
  await editPanelPage.pageObjects.visualizationTab.click();
  await editPanelPage.pageObjects.showXAxis.click();
  await editPanelPage.pageObjects.saveDashboard.click();

  // Confirm save modal
  await saveDashboardModal.init(page);
  await saveDashboardModal.expectSelector({ selector: 'save-dashboard-as-modal' });
  await saveDashboardModal.pageObjects.name.enter(dashboardTitle);
  await saveDashboardModal.pageObjects.save.click();
  await saveDashboardModal.pageObjects.success.exists();

  return dashboardTitle;
};

export const clickOnSharePanelImageLinkAndCompareImages = async (
  browser: Browser,
  page: Page,
  dashboardTitle: string
) => {
  // Share the dashboard
  const dashboardsPage = dashboardsPageFactory(dashboardTitle);
  await dashboardsPage.init(page);
  await dashboardsPage.navigateTo();
  await dashboardsPage.pageObjects.dashboard.exists();
  await dashboardsPage.pageObjects.dashboard.click();

  await panel.init(page);
  await panel.pageObjects.panelTitle.click();
  await panel.pageObjects.share.click();

  // Verify that a new tab is opened
  const targetPromise = new Promise(resolve => browser.once('targetcreated', resolve));
  await sharePanelModal.init(page);
  await sharePanelModal.pageObjects.directLinkRenderedImage.click();
  const newTarget: Target = (await targetPromise) as Target;
  expect(newTarget.url()).toContain(`${constants.baseUrl}/render/d-solo`);

  // Take snapshot of page only when running on CircleCI
  if (process.env.CIRCLE_SHA1) {
    const newPage = await newTarget.page();
    const fileName = 'smoke-test-scenario';
    await takeScreenShot(newPage, fileName);
    await compareScreenShots(fileName);
  }
};

e2eScenario({
  describeName: 'Smoke tests',
  itName: 'Login scenario, create test data source, dashboard, panel, and export scenario',
  skipScenario: false,
  createTestDataSource: true,
  scenario: async (browser: Browser, page: Page) => {
    const dashboardTitle = await addDashboardAndSetupTestDataGraph(page);
    await clickOnSharePanelImageLinkAndCompareImages(browser, page, dashboardTitle);
    await cleanDashboard(page, dashboardTitle);
  },
});
