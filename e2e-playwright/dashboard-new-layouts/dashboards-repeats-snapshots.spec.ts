import { type Page } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { type SnapshotCreateResponse } from '../../public/app/features/dashboard/services/SnapshotSrv';
import testV2DashWithRepeats from '../dashboards/V2DashWithRepeats.json';

import { Controls, Panel, Sidebar } from './page-objects';
import { importTestDashboard, saveDashboard } from './utils';

const repeatTitleBase = 'repeat - ';
const repeatOptions = [1, 2, 3, 4];

async function expectRepeatPanelsRendered(panel: Panel, expectedCount: number) {
  // Snapshot rendering can interpolate the repeat variable differently (for example, as a single multi-value string),
  // so assert on the number of repeated panels rather than exact per-clone titles.
  const repeatedPanels = panel.getHeadersByTitle(new RegExp(`^${repeatTitleBase}`));
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
      components,
    }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - custom grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Sanity check: repeats exist before snapshot.
      await expectRepeatPanelsRendered(panel, repeatOptions.length);

      await controls.openShareSnapshotDrawer();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(controls.getContainer()).toBeVisible();

      // Regression: snapshot must include repeat clones; otherwise panels are missing / fail to render.
      await expectRepeatPanelsRendered(panel, repeatOptions.length);
    });

    test('dashboard snapshot renders repeated panels (auto grid)', async ({
      dashboardPage,
      selectors,
      page,
      components,
    }) => {
      const controls = new Controls({ page, dashboardPage, selectors, components });
      const panel = new Panel({ page, dashboardPage, selectors, components });
      const sidebar = new Sidebar({ page, dashboardPage, selectors, components });

      await importTestDashboard(
        page,
        selectors,
        'Snapshots repeats - auto grid',
        JSON.stringify(testV2DashWithRepeats)
      );

      // Convert layout to auto grid and persist it, then snapshot.
      await controls.enterEditMode();
      await sidebar.toolbar.clickButton('Options');
      await sidebar.dashboardOptions.switchLayout('auto', { confirm: true });
      await saveDashboard(dashboardPage, page, selectors);
      await page.reload();

      await expectRepeatPanelsRendered(panel, repeatOptions.length);

      await controls.openShareSnapshotDrawer();

      const snapshotUrl = await publishDashboardSnapshot(page, dashboardPage, selectors);
      await page.goto(snapshotUrl);
      await expect(controls.getContainer()).toBeVisible();

      await expectRepeatPanelsRendered(panel, repeatOptions.length);
    });
  }
);
