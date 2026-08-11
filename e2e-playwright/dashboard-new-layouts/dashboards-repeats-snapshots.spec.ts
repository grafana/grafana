import { type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { type SnapshotCreateResponse } from '../../public/app/features/dashboard/services/SnapshotSrv';
import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';

import { test, expect } from './fixtures';
import { type Panels } from './page-objects';
import { importTestDashboard, saveDashboardAndCloseToast } from './utils';

const repeatTitleBase = 'repeat - ';
const repeatOptions = [1, 2, 3, 4];

async function expectRepeatPanelsRendered(panels: Panels, expectedCount: number) {
  // Snapshot rendering can interpolate the repeat variable differently (for example, as a single multi-value string),
  // so assert on the number of repeated panels rather than exact per-clone titles.
  const repeatedPanels = panels.getHeaders(new RegExp(`^${repeatTitleBase}`));
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

  const publishSnapshotButton = dashboardPage.getByGrafanaSelector(
    selectors.pages.ShareDashboardDrawer.ShareSnapshot.publishSnapshot
  );
  await expect(publishSnapshotButton).toBeVisible();
  await publishSnapshotButton.click();

  const createResponse = await createSnapshotPromise;
  expect(createResponse.status()).toBe(200);

  const responseBody: SnapshotCreateResponse = await createResponse.json();
  return `/dashboard/snapshot/${responseBody.key}`;
}

test.use({
  featureToggles: {
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
    test('dashboard snapshot renders repeated panels (custom grid)', async ({
      dashboardPage,
      selectors,
      page,
      controls,
      panels,
    }) => {
      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - custom grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Sanity check: repeats exist before snapshot.
      await expectRepeatPanelsRendered(panels, repeatOptions.length);

      await controls.openShareSnapshotDrawer();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(controls.getContainer()).toBeVisible();

      // Regression: snapshot must include repeat clones; otherwise panels are missing / fail to render.
      await expectRepeatPanelsRendered(panels, repeatOptions.length);
    });

    test('dashboard snapshot renders repeated panels (auto grid)', async ({
      dashboardPage,
      selectors,
      page,
      controls,
      sidebar,
      panels,
    }) => {
      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - auto grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Convert layout to auto grid and persist it, then snapshot.
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');
      await sidebar.dashboardOptions.gridLayoutOptions.switchLayout('Auto', { confirm: true });
      await saveDashboardAndCloseToast(page, controls);
      await page.reload();

      await expectRepeatPanelsRendered(panels, repeatOptions.length);

      await controls.openShareSnapshotDrawer();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(controls.getContainer()).toBeVisible();

      await expectRepeatPanelsRendered(panels, repeatOptions.length);
    });
  }
);
