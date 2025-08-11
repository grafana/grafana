import { test, expect } from '@grafana/plugin-e2e';

import scopesDashboardOne from '../dashboards/scopes-cujs/scopeDashboardOne.json';
import scopesDashboardThree from '../dashboards/scopes-cujs/scopeDashboardThree.json';
import scopesDashboardTwo from '../dashboards/scopes-cujs/scopeDashboardTwo.json';
import { setScopes } from '../utils/scope-helpers';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.USE_LIVE_DATA);
const LIVE_DASHBOARD_UID = process.env.LIVE_DASHBOARD_UID;

export const DASHBOARD = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-1';
export const DASHBOARD_TWO = USE_LIVE_DATA && LIVE_DASHBOARD_UID ? LIVE_DASHBOARD_UID : 'scopes-dashboard-2';

test.describe(
  'Dashboard navigation CUJs',
  {
    tag: ['@dashnav-cujs'],
  },
  () => {
    let dashboardUIDs: string[] = [];

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      for (const dashboard of [scopesDashboardOne, scopesDashboardTwo, scopesDashboardThree]) {
        let response = await request.post('/api/dashboards/import', {
          data: {
            dashboard,
            folderUid: '',
            overwrite: true,
            inputs: [],
          },
        });
        let responseBody = await response.json();
        dashboardUIDs.push(responseBody.uid);
      }
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      for (const dashboardUID of dashboardUIDs) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Navigate between dashboards', async ({ page, gotoDashboardPage, selectors }) => {
      await test.step('1.Search dashboard', async () => {
        await gotoDashboardPage({ uid: DASHBOARD });

        await setScopes(page, USE_LIVE_DATA);

        await page.waitForTimeout(1000);

        const scopeDashboards = page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]');
        const firstDbName = await scopeDashboards.first().textContent();
        const scopeDashboardsCount = await scopeDashboards.count();

        expect(scopeDashboardsCount).toBeGreaterThan(0);

        const scopeDashboardSearch = page.getByTestId('scopes-dashboards-search');
        await scopeDashboardSearch.fill(firstDbName!.trim().slice(0, 5));

        await page.waitForTimeout(500);

        expect(await scopeDashboards.count()).not.toBe(scopeDashboardsCount);
      });

      await test.step('2.Timeselection persisting', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        await setScopes(page, USE_LIVE_DATA);

        await page.waitForTimeout(1000);

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        await expect(markdownContent).toContainText(`now-6h`);

        const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);

        await timePickerButton.click();
        const label = page.getByText('Last 12 hours');
        await label.click();

        await expect(markdownContent).toContainText(`now-12h`);

        await page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]').first().click();
        await page.waitForURL('**/d/**');

        await page.waitForTimeout(500);

        await expect(markdownContent).toContainText(`now-12h`);
      });

      await test.step('3.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_TWO });

        await setScopes(page, USE_LIVE_DATA, { title: 'Scopes Dashboard 3', uid: 'scopes-dashboard-3' });

        await page.waitForTimeout(500);

        const pills = await page.getByLabel(/^Edit filter with key/).allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        // no groupBy value
        await expect(markdownContent).toContainText(`GroupByVar: \n\nAdHocVar: ${processedPills}`);

        const groupByVariable = dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('groupBy'))
          .locator('..')
          .locator('input');

        // add a custom groupBy value
        await groupByVariable.click();
        await groupByVariable.fill('dev');
        await groupByVariable.press('Enter');
        await groupByVariable.press('Escape');

        await page.waitForTimeout(500);

        await page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]').first().click();
        await page.waitForURL('**/d/**');

        //all values are set after dashboard switch
        await expect(markdownContent).toContainText(`GroupByVar: dev\n\nAdHocVar: ${processedPills}`);
      });

      await test.step('4.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD });

        await setScopes(page, USE_LIVE_DATA, { title: 'Scopes Dashboard 2', uid: 'scopes-dashboard-2' });

        await page.waitForTimeout(500);

        const pills = page.getByLabel(/^Edit filter with key/);
        const pillCount = await pills.count();
        const pillTexts = await pills.allTextContents();
        const processedPills = pillTexts
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        const groupByVals = page
          .getByTestId(/^GroupBySelect-/)
          .first()
          .locator('div:has(+ button)');
        const groupByCount = await groupByVals.count();
        const selectedValues = (await groupByVals.allTextContents()).join(', ');

        // assert the panel is visible and has the correct value
        const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content).first();
        await expect(panelContent).toBeVisible();
        const markdownContent = panelContent.locator('.markdown-html');
        const oldFilters = `GroupByVar: ${selectedValues}\n\nAdHocVar: ${processedPills}`;
        await expect(markdownContent).toContainText(oldFilters);

        await page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]').first().click();
        await page.waitForURL('**/d/**');

        const newPillCount = await pills.count();
        const newGroupByCount = await groupByVals.count();

        expect(newPillCount).not.toEqual(pillCount);
        expect(newGroupByCount).not.toEqual(groupByCount);
        expect(newGroupByCount).toBe(0);
      });
    });
  }
);
