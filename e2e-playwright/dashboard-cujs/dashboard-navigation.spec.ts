import { test, expect } from '@grafana/plugin-e2e';

import { setScopes } from '../utils/scope-helpers';
import {
  getAdHocFilterPills,
  getGroupByInput,
  getGroupByValues,
  getMarkdownHTMLContent,
  getScopesDashboards,
  getScopesDashboardsSearchInput,
  getScopesSelectorInput,
} from './cuj-selectors';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

export const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';
export const NAVIGATE_TO = 'cuj-dashboard-2';

test.describe(
  'Dashboard navigation CUJs',
  {
    tag: ['@dashboard-cujs'],
  },
  () => {
    test('Navigate between dashboards', async ({ page, gotoDashboardPage, selectors }) => {
      const scopeSelectorInput = getScopesSelectorInput(page);
      const scopesDashboards = getScopesDashboards(page);
      const scopesDashboardsSearchInput = getScopesDashboardsSearchInput(page);
      const adhocFilterPills = getAdHocFilterPills(page);
      const groupByValues = getGroupByValues(page);

      await test.step('1.Search dashboard', async () => {
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page);

        await expect(scopeSelectorInput).toHaveValue(/.+/);

        const firstDbName = await scopesDashboards.first().textContent();
        const scopeDashboardsCount = await scopesDashboards.count();

        expect(scopeDashboardsCount).toBeGreaterThan(0);

        await scopesDashboardsSearchInput.fill(firstDbName!.trim().slice(0, 5));

        await expect(scopesDashboards).not.toHaveCount(scopeDashboardsCount);
      });

      await test.step('2.Time selection persisting', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page);

        await expect(scopeSelectorInput).toHaveValue(/.+/);

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        await expect(markdownContent).toContainText(`now-6h`);

        const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);

        await timePickerButton.click();
        const label = page.getByText('Last 12 hours');
        await label.click();

        await expect(markdownContent).toContainText(`now-12h`);

        await scopesDashboards.first().click();
        await page.waitForURL('**/d/**');

        await expect(markdownContent).toBeVisible();
        await expect(markdownContent).toContainText(`now-12h`);
      });

      await test.step('3.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: NAVIGATE_TO });

        await setScopes(page, { title: 'CUJ Dashboard 3', uid: 'cuj-dashboard-3' });

        await expect(scopeSelectorInput).toHaveValue(/.+/);

        const pills = await adhocFilterPills.allTextContents();
        const processedPills = pills
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        // no groupBy value
        await expect(markdownContent).toContainText(`GroupByVar: \n\nAdHocVar: ${processedPills}`);

        const groupByVariable = getGroupByInput(dashboardPage, selectors);

        // add a custom groupBy value
        await groupByVariable.click();
        await groupByVariable.fill('dev');
        await groupByVariable.press('Enter');
        await groupByVariable.press('Escape');

        await expect(scopesDashboards.first()).toBeVisible();
        await scopesDashboards.first().click();
        await page.waitForURL('**/d/**');

        //all values are set after dashboard switch
        await expect(markdownContent).toContainText(`GroupByVar: dev\n\nAdHocVar: ${processedPills}`);
      });

      await test.step('4.See filter/groupby selection persisting when navigating from dashboard to dashboard', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page, { title: 'CUJ Dashboard 2', uid: 'cuj-dashboard-2' });

        await expect(scopeSelectorInput).toHaveValue(/.+/);

        const pillCount = await adhocFilterPills.count();
        const pillTexts = await adhocFilterPills.allTextContents();
        const processedPills = pillTexts
          .map((p) => {
            const parts = p.split(' ');
            return `${parts[0]}${parts[1]}"${parts[2]}"`;
          })
          .join(',');

        const groupByCount = await groupByValues.count();
        const selectedValues = (await groupByValues.allTextContents()).join(', ');

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);

        const oldFilters = `GroupByVar: ${selectedValues}\n\nAdHocVar: ${processedPills}`;
        await expect(markdownContent).toContainText(oldFilters);

        await expect(scopesDashboards.first()).toBeVisible();
        await scopesDashboards.first().click();
        await page.waitForURL('**/d/**');

        const newPillCount = await adhocFilterPills.count();
        const newGroupByCount = await groupByValues.count();

        expect(newPillCount).not.toEqual(pillCount);
        expect(newGroupByCount).not.toEqual(groupByCount);
        expect(newGroupByCount).toBe(0);
      });
    });
  }
);
