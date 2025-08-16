import { test, expect } from '@grafana/plugin-e2e';

import { setScopes } from '../utils/scope-helpers';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.USE_LIVE_DATA);

export const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';
export const NAVIGATE_TO = 'cuj-dashboard-2';

test.describe(
  'Dashboard navigation CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Navigate between dashboards', async ({ page, gotoDashboardPage, selectors }) => {
      await test.step('1.Search dashboard', async () => {
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page, USE_LIVE_DATA);

        await expect(page.getByTestId('scopes-selector-input')).toHaveValue(/.+/);

        const scopeDashboards = page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]');
        const firstDbName = await scopeDashboards.first().textContent();
        const scopeDashboardsCount = await scopeDashboards.count();

        expect(scopeDashboardsCount).toBeGreaterThan(0);

        const scopeDashboardSearch = page.getByTestId('scopes-dashboards-search');
        await scopeDashboardSearch.fill(firstDbName!.trim().slice(0, 5));

        await expect(scopeDashboards).not.toHaveCount(scopeDashboardsCount);
      });

      await test.step('2.Timeselection persisting', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page, USE_LIVE_DATA);

        await expect(page.getByTestId('scopes-selector-input')).toHaveValue(/.+/);

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

        await expect(markdownContent).toBeVisible();
        await expect(markdownContent).toContainText(`now-12h`);
      });

      await test.step('3.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: NAVIGATE_TO });

        await setScopes(page, USE_LIVE_DATA, { title: 'CUJ Dashboard 3', uid: 'cuj-dashboard-3' });

        await expect(page.getByTestId('scopes-selector-input')).toHaveValue(/.+/);

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

        const scopeDashboards = page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]');

        await expect(scopeDashboards.first()).toBeVisible();
        await scopeDashboards.first().click();
        await page.waitForURL('**/d/**');

        //all values are set after dashboard switch
        await expect(markdownContent).toContainText(`GroupByVar: dev\n\nAdHocVar: ${processedPills}`);
      });

      await test.step('4.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page, USE_LIVE_DATA, { title: 'CUJ Dashboard 2', uid: 'cuj-dashboard-2' });

        await expect(page.getByTestId('scopes-selector-input')).toHaveValue(/.+/);

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

        const scopeDashboards = page.locator('[data-testid^="scopes-dashboards-"][role="treeitem"]');

        await expect(scopeDashboards.first()).toBeVisible();
        await scopeDashboards.first().click();
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
