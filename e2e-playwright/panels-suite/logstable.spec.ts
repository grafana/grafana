import { Page, Locator } from '@playwright/test';

import { test, expect, E2ESelectorGroups } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'adhjhtt';

test.use({ viewport: { width: 2000, height: 1080 } });
test.describe('Panels test: LogsTable - Kitchen Sink', { tag: ['@panels', '@logstable'] }, () => {
  test.only('should render logs table panel', async ({ page, gotoDashboardPage, selectors }) => {
    await page.pause();

    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await page.pause();

    page.goto('localhost:3001/d/adhjhtt/');

    //http://localhost:3001/d/adhjhtt/

    await page.pause();

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Default Logs Table Panel'))
    ).toBeVisible();

    await page.pause();
  });
});
