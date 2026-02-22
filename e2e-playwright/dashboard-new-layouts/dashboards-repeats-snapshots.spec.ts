import { Page } from '@playwright/test';

import { test, expect, DashboardPage, E2ESelectorGroups } from '@grafana/plugin-e2e';

import { SnapshotCreateResponse } from '../../public/app/features/dashboard/services/SnapshotSrv';
import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';

import { importTestDashboard, saveDashboard, switchToAutoGrid } from './utils';

const repeatTitleBase = 'repeat - ';
const repeatOptions = [1, 2, 3, 4];

async function expectRepeatPanelsRendered(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  expectedCount: number
) {
  // Snapshot rendering can interpolate the repeat variable differently (for example, as a single multi-value string),
  // so assert on the number of repeated panels rather than exact per-clone titles.
  const repeatedPanels = dashboardPage
    .getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer)
    .filter({ hasText: new RegExp(`^${repeatTitleBase}`) });

  await expect(repeatedPanels).toHaveCount(expectedCount);
  await expect(repeatedPanels.first()).toBeVisible();
}

async function publishDashboardSnapshot(
  page: Page,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups
): Promise<string> {
  const createSnapshotPromise = page.waitForResponse(
    (response) => response.url().includes('/api/snapshots') && response.request().method() === 'POST'
  );

  await expect(
    dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot)
  ).toBeVisible();
  await dashboardPage.getByGrafanaSelector(selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot).click();

  const createResponse = await createSnapshotPromise;
  expect(createResponse.status()).toBe(200);

  const responseBody: SnapshotCreateResponse = await createResponse.json();
  return `/dashboard/snapshot/${responseBody.key}`;
}

test.use({
  featureToggles: {
    scenes: true,
    kubernetesDashboards: true,
    dashboardNewLayouts: true,
    groupByVariable: true,
  },
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Snapshots - repeats',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('dashboard snapshot renders repeated panels (custom grid)', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - custom grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Sanity check: repeats exist before snapshot.
      await expectRepeatPanelsRendered(dashboardPage, selectors, repeatOptions.length);

      // Open share drawer -> Share snapshot.
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareSnapshot)
        .click();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls)).toBeVisible();

      // Regression: snapshot must include repeat clones; otherwise panels are missing / fail to render.
      await expectRepeatPanelsRendered(dashboardPage, selectors, repeatOptions.length);
    });

    test('dashboard snapshot renders repeated panels (auto grid)', async ({ dashboardPage, selectors, page }) => {
      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - auto grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Convert layout to auto grid and persist it, then snapshot.
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Sidebar.optionsButton).click();
      await switchToAutoGrid(page, dashboardPage);
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expectRepeatPanelsRendered(dashboardPage, selectors, repeatOptions.length);

      await dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.arrowMenu).click();
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.DashNav.newShareButton.menu.shareSnapshot)
        .click();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls)).toBeVisible();

      await expectRepeatPanelsRendered(dashboardPage, selectors, repeatOptions.length);
    });
  }
);
