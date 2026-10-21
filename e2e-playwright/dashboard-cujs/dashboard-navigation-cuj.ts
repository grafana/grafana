import { test, expect } from '@grafana/plugin-e2e';

import { setScopes, setupScopeRoutes } from '../utils/scope-helpers';
import { testScopes } from '../utils/scopes';

import {
  clickFirstScopesDashboard,
  expandAdHocFilters,
  expectGroupByInUrl,
  getAdHocFilterPills,
  getGroupByInput,
  getGroupByPills,
  getMarkdownHTMLContent,
  getScopesDashboards,
  getScopesDashboardsSearchInput,
  getScopesSelectorInput,
} from './cuj-selectors';
import { checkDashboardReloadBehavior, getConfigDashboards, trackDashboardReloadRequests } from './utils';

const USE_LIVE_DATA = Boolean(process.env.API_CONFIG_PATH);
const DASHBOARD_UNDER_TEST = 'cuj-dashboard-1';
const DASHBOARD_UNDER_TEST_2 = 'cuj-dashboard-2';
const NAVIGATE_TO = 'cuj-dashboard-3';

/**
 * Shared by dashboard-navigation.spec.ts and dashboard-navigation-mega-menu.spec.ts, which run this
 * same CUJ under the two states of the scopesDashboardsMegaMenu flag. It has to live in its own
 * non-spec module and be called from two separate spec files rather than two describe blocks in one
 * file, because `openFeature` can only be overridden at the top level of a test file - overriding it
 * inside a describe block forces a new worker, which Playwright doesn't support.
 *
 * `megaMenu` must match the `grafana.scopesDashboardsMegaMenu` flag value set by the calling spec
 * file's `test.use({ openFeature: ... })`, and is used purely to label the describe/test titles so
 * the two flag states are distinguishable in reports, `--grep`, and flake tracking.
 */
export function runDashboardNavigationCujs({ megaMenu }: { megaMenu: boolean }) {
  const scenario = megaMenu ? '(scopes mega menu flag on)' : '(scopes mega menu flag off)';

  test.describe(
    `Dashboard navigation CUJs ${scenario}`,
    {
      tag: ['@dashboard-cujs'],
    },
    () => {
      test(`Navigate between dashboards ${scenario}`, async ({ page, gotoDashboardPage, selectors }) => {
        const scopesDashboardsContainer = page.getByTestId('scopes-dashboards-container');
        const scopeSelectorInput = getScopesSelectorInput(page);
        const scopesDashboards = getScopesDashboards(page);
        const scopesDashboardsSearchInput = getScopesDashboardsSearchInput(page);
        const adhocFilterPills = getAdHocFilterPills(page);
        const groupByPills = getGroupByPills(page);

        // Set up routes before any navigation (only for mocked mode)
        if (!USE_LIVE_DATA) {
          await setupScopeRoutes(page, testScopes());
        }

        await test.step('1.Search dashboard', async () => {
          await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

          await setScopes(page);

          await expect(scopesDashboardsContainer).toBeVisible();
          await expect(scopesDashboardsContainer).toHaveCount(1);

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

          await expect(scopesDashboardsContainer).toBeVisible();
          await expect(scopesDashboardsContainer).toHaveCount(1);

          await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

          // assert the panel is visible and has the correct value
          const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
          await expect(markdownContent).toContainText(`now-6h`);

          const timePickerButton = page.getByTestId(selectors.components.TimePicker.openButton);

          await timePickerButton.click();
          const label = page.getByTestId(selectors.components.TimePicker.timeRangeOption('now-12h', 'now'));
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
              const dashboardPage = await gotoDashboardPage({ uid: db });

              await setScopes(page, { title: 'CUJ Dashboard 3', uid: NAVIGATE_TO });

              await expect(scopesDashboardsContainer).toBeVisible();
              await expect(scopesDashboardsContainer).toHaveCount(1);

              await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

              await expandAdHocFilters(page);
              const pills = await adhocFilterPills.allTextContents();
              const processedPills = pills
                .map((p) => {
                  const parts = p.split(' ');
                  return `${parts[0]}${parts[1]}"${parts[2]}"`;
                })
                .join(',');

              // assert the panel is visible and has the correct value
              const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
              await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
              await expect(groupByPills).toHaveCount(0);

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
              await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);
              await expect(groupByPills.filter({ hasText: 'dev' })).toBeVisible();
              await expectGroupByInUrl(page, 'dev');
            }
          );
        }

        await test.step('4.Unmodified default filters and groupBy keys are not propagated to a different dashboard', async () => {
          const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UNDER_TEST });

          await setScopes(page, { title: 'CUJ Dashboard 2', uid: 'cuj-dashboard-2' });

          await expect(scopesDashboardsContainer).toBeVisible();
          await expect(scopesDashboardsContainer).toHaveCount(1);

          await expect(scopeSelectorInput).toHaveAttribute('data-value', /.+/);

          await expandAdHocFilters(page);
          const pillCount = await adhocFilterPills.count();
          const pillTexts = await adhocFilterPills.allTextContents();
          const processedPills = pillTexts
            .map((p) => {
              const parts = p.split(' ');
              return `${parts[0]}${parts[1]}"${parts[2]}"`;
            })
            .join(',');

          const groupByCount = await groupByPills.count();

          // assert the panel is visible and has the correct value
          const markdownContent = await getMarkdownHTMLContent(dashboardPage, selectors);
          await expect(markdownContent).toContainText(`AdHocVar: ${processedPills}`);

          await clickFirstScopesDashboard(page);
          await page.waitForURL('**/d/**');

          await expandAdHocFilters(page);
          const newPillCount = await adhocFilterPills.count();
          const newGroupByCount = await groupByPills.count();

          expect(newPillCount).not.toEqual(pillCount);
          expect(newGroupByCount).not.toEqual(groupByCount);
          expect(newGroupByCount).toBe(0);
        });
      });
    }
  );
}
