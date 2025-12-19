import { test, expect } from '@grafana/plugin-e2e';

import { clearScopeApiCache, clearScopeRoutes, setScopes, setupScopeRoutes } from '../utils/scope-helpers';
import { testScopes } from '../utils/scopes';

import {
  clickFirstScopesDashboard,
  getAdHocFilterPills,
  getGroupByInput,
  getGroupByValues,
  getMarkdownHTMLContent,
  getScopesDashboards,
  getScopesDashboardsSearchInput,
  getScopesSelectorInput,
} from './cuj-selectors';
import { checkDashboardReloadBehavior, getConfigDashboards, trackDashboardReloadRequests } from './utils';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

const USE_LIVE_DATA = Boolean(process.env.API_CONFIG_PATH);
const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';
const DASHBOARD_UNDER_TEST_2 = 'cuj-dashboard-2';
const NAVIGATE_TO = 'cuj-dashboard-3';

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

      // Set up routes before any navigation (only for mocked mode)
      if (!USE_LIVE_DATA) {
        await setupScopeRoutes(page, testScopes());
      }

      await test.step('1.Search dashboard', async () => {
        await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page);

        await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

        const firstDbName = await scopesDashboards.first().textContent();
        const scopeDashboardsCount = await scopesDashboards.count();

        expect(scopeDashboardsCount).toBeGreaterThan(0);

        await scopesDashboardsSearchInput.fill(firstDbName!.trim().slice(0, 5));

        await expect(scopesDashboards).not.toHaveCount(scopeDashboardsCount);
      });

      await test.step('2.Time selection persisting', async () => {
        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page);

        await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

        // assert the panel is visible and has the correct value
        const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
        await expect(markdownContent).toContainText(`now-6h`);

        const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);

        await timePickerButton.click();
        const label = page.getByText('Last 12 hours');
        await label.click();

        await expect(markdownContent).toContainText(`now-12h`);

        await clickFirstScopesDashboard(page);
        await page.waitForURL('**/d/**');

        await expect(markdownContent).toBeVisible();
        await expect(markdownContent).toContainText(`now-12h`);
      });

      const dashboards = await getConfigDashboards();
      if (dashboards.length === 0) {
        dashboards.push(DASHBOARD_UNDER_TEST_2);
      }

      for (const db of dashboards) {
        await test.step(
          '3.See filter/groupby selection persisting when navigating from dashboard to dashboard - ' + db,
          async () => {
            // Re-setup routes with the correct dashboard binding for this step
            if (!USE_LIVE_DATA) {
              await clearScopeRoutes(page);
              await clearScopeApiCache(page); // Clear RTK Query cache so new mock data is fetched
              await setupScopeRoutes(page, testScopes({ title: 'CUJ Dashboard 3', uid: NAVIGATE_TO }));
            }

            const dashboardPage = await gotoDashboardPage({ uid: db });

            await setScopes(page, { title: 'CUJ Dashboard 3', uid: NAVIGATE_TO });

            await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

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

            const { getRequests, waitForExpectedRequests } = await trackDashboardReloadRequests(page);

            await clickFirstScopesDashboard(page);
            await page.waitForURL('**/d/**');
            await waitForExpectedRequests();
            await page.waitForLoadState('networkidle');

            const requests = getRequests();
            expect(checkDashboardReloadBehavior(requests)).toBe(true);

            //all values are set after dashboard switch
            await expect(markdownContent).toContainText(`GroupByVar: dev\n\nAdHocVar: ${processedPills}`);
          }
        );
      }

      await test.step('4.Unmodified default filters and groupBy keys are not propagated to a different dashboard', async () => {
        // Re-setup routes with the correct dashboard binding for this step
        if (!USE_LIVE_DATA) {
          await clearScopeRoutes(page);
          await clearScopeApiCache(page); // Clear RTK Query cache so new mock data is fetched
          await setupScopeRoutes(page, testScopes({ title: 'CUJ Dashboard 2', uid: 'cuj-dashboard-2' }));
        }

        const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

        await setScopes(page, { title: 'CUJ Dashboard 2', uid: 'cuj-dashboard-2' });

        await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

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

        await clickFirstScopesDashboard(page);
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
