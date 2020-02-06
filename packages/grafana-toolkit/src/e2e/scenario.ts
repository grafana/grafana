import { Browser, Page } from 'puppeteer-core';
import { launchBrowser } from './launcher';
import { ensureLoggedIn } from './login';
import { cleanDashboard, createEmptyDashboardPage } from './pages/dashboards/createDashboardPage';
import { DashboardPage } from './pages/dashboards/dashboardPage';
import { TestPage } from './pageInfo';
import { addTestDataSourceAndVerify, cleanUpTestDataSource } from './pages/datasources/dataSources';

export interface ScenarioArguments {
  describeName: string;
  itName: string;
  scenario: (browser: Browser, page: Page, datasourceName?: string, dashboardPage?: TestPage<DashboardPage>) => void;
  skipScenario?: boolean;
  createTestDataSource?: boolean;
  createTestDashboard?: boolean;
}

export const e2eScenario = ({
  describeName,
  itName,
  scenario,
  skipScenario = false,
  createTestDataSource = false,
  createTestDashboard = false,
}: ScenarioArguments) => {
  describe(describeName, () => {
    if (skipScenario) {
      it.skip(itName, async () => {
        expect(false).toBe(true);
      });
      return;
    }

    let browser: Browser;
    let page: Page;
    let testDataSourceName: string;
    let testDashboardTitle: string;
    let dashboardPage: TestPage<DashboardPage>;

    beforeAll(async () => {
      browser = await launchBrowser();
      page = await browser.newPage();
      await ensureLoggedIn(page);
      if (createTestDataSource) {
        testDataSourceName = await addTestDataSourceAndVerify(page);
      }
      if (createTestDashboard) {
        testDashboardTitle = `e2e - ${new Date().getTime()}`;
        dashboardPage = await createEmptyDashboardPage(page, testDashboardTitle);
      }
    });

    afterAll(async () => {
      if (testDataSourceName) {
        await cleanUpTestDataSource(page, testDataSourceName);
      }
      if (testDashboardTitle && dashboardPage) {
        await cleanDashboard(page, testDashboardTitle);
      }
      if (browser) {
        await browser.close();
      }
    });

    it(itName, async () => {
      await scenario(browser, page, testDataSourceName, dashboardPage);
    });
  });
};
