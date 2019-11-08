import { Browser, Page, Target } from 'puppeteer-core';

import { compareScreenShots, constants, e2eScenario, takeScreenShot } from '@grafana/toolkit/src/e2e';
import { addDataSourcePage } from 'e2e-test/pages/datasources/addDataSourcePage';
import { editDataSourcePage } from 'e2e-test/pages/datasources/editDataSourcePage';
import { dataSourcesPageFactory } from 'e2e-test/pages/datasources/dataSources';
import { createDashboardPage } from 'e2e-test/pages/dashboards/createDashboardPage';
import { saveDashboardModal } from 'e2e-test/pages/dashboards/saveDashboardModal';
import { dashboardsPageFactory } from 'e2e-test/pages/dashboards/dashboardsPage';
import { panel } from 'e2e-test/pages/panels/panel';
import { editPanelPage } from 'e2e-test/pages/panels/editPanel';
import { sharePanelModal } from 'e2e-test/pages/panels/sharePanelModal';
import { confirmModal } from '../pages/modals/confirmModal';
import { dashboardPage } from '../pages/dashboards/dashboardPage';
import { dashboardSettingsPage } from '../pages/dashboards/dashboardSettingsPage';

const addTestDataSourceAndVerify = async (page: Page) => {
  // Add TestData DB
  const testDataSourceName = `TestData-${new Date().getTime()}`;
  await addDataSourcePage.init(page);
  await addDataSourcePage.navigateTo();
  await addDataSourcePage.pageObjects.testDataDB.exists();
  await addDataSourcePage.pageObjects.testDataDB.click();

  await editDataSourcePage.init(page);
  await editDataSourcePage.waitForNavigation();
  await editDataSourcePage.pageObjects.name.enter(testDataSourceName);
  await editDataSourcePage.pageObjects.saveAndTest.click();
  await editDataSourcePage.pageObjects.alert.exists();
  await editDataSourcePage.pageObjects.alertMessage.containsText('Data source is working');

  // Verify that data source is listed
  const url = await editDataSourcePage.getUrlWithoutBaseUrl();
  const expectedUrl = url.substring(1, url.length - 1);
  const selector = `a[href="${expectedUrl}"]`;

  const dataSourcesPage = dataSourcesPageFactory(testDataSourceName);
  await dataSourcesPage.init(page);
  await dataSourcesPage.navigateTo();
  await dataSourcesPage.expectSelector({ selector });

  return testDataSourceName;
};

const addDashboardAndSetupTestDataGraph = async (page: Page) => {
  // Create a new Dashboard
  const dashboardTitle = `Dashboard-${new Date().getTime()}`;
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

const clickOnSharePanelImageLinkAndCompareImages = async (browser: Browser, page: Page, dashboardTitle: string) => {
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

const cleanUpTestDataSource = async (page: Page, testDataSourceName: string) => {
  const dataSourcesPage = dataSourcesPageFactory(testDataSourceName);
  await dataSourcesPage.init(page);
  await dataSourcesPage.navigateTo();
  await dataSourcesPage.pageObjects.testData.click();

  await editDataSourcePage.init(page);
  await editDataSourcePage.pageObjects.delete.exists();
  await editDataSourcePage.pageObjects.delete.click();

  await confirmModal.init(page);
  await confirmModal.pageObjects.delete.click();
  await confirmModal.pageObjects.success.exists();
};

const cleanDashboard = async (page: Page, dashboardTitle: string) => {
  const dashboardsPage = dashboardsPageFactory(dashboardTitle);
  await dashboardsPage.init(page);
  await dashboardsPage.navigateTo();
  await dashboardsPage.pageObjects.dashboard.exists();
  await dashboardsPage.pageObjects.dashboard.click();

  await dashboardPage.init(page);
  await dashboardPage.pageObjects.settings.click();

  await dashboardSettingsPage.init(page);
  await dashboardSettingsPage.pageObjects.deleteDashBoard.click();

  await confirmModal.init(page);
  await confirmModal.pageObjects.delete.click();
  await confirmModal.pageObjects.success.exists();
};

e2eScenario(
  'Login scenario, create test data source, dashboard, panel, and export scenario',
  'should pass',
  async (browser: Browser, page: Page) => {
    const testDataSourceName = await addTestDataSourceAndVerify(page);
    const dashboardTitle = await addDashboardAndSetupTestDataGraph(page);
    await clickOnSharePanelImageLinkAndCompareImages(browser, page, dashboardTitle);
    await cleanUpTestDataSource(page, testDataSourceName);
    await cleanDashboard(page, dashboardTitle);
  }
);
