import { expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'tcmp-e2e-001';
const LIVE_DASHBOARD_UID = 'tcmp-e2e-002';

const PANEL_DAY_BEFORE = 'Time comparison - day before';
const PANEL_TIME_SHIFT = 'Time comparison with time shift';
const PANEL_UI_TEST = 'Time comparison - UI test';
const PANEL_LIVE = 'Time comparison - live';

test.use({
  featureToggles: {
    timeComparison: true,
    panelTimeSettings: true,
  },
});

test.describe('Panels test: TimeSeries Time Comparison', { tag: ['@panels', '@timeseries'] }, () => {
  test('UI: opens Time settings drawer and saves time comparison', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await test.step('Load dashboard', async () => {
      return gotoDashboardPage({ uid: DASHBOARD_UID });
    });

    await test.step('Open Time settings drawer via panel menu', async () => {
      const panelTitle = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_UI_TEST));
      await panelTitle.hover();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UI_TEST))
        .click({ force: true });
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Time settings')).click();
    });

    await test.step('Select "Day before" in Time comparison and apply', async () => {
      const drawer = page.getByRole('dialog', { name: 'Panel time settings' });
      await expect(drawer, 'drawer opened').toBeVisible();

      // Time comparison is the 3rd combobox in the drawer (after Panel time range and Time shift)
      const compareCombobox = drawer.getByRole('combobox').nth(2);
      await compareCombobox.click();
      await page.getByRole('option', { name: 'Day before' }).click();

      await page.getByRole('button', { name: 'Apply' }).click();
    });

    await test.step('Verify comparison series is rendered', async () => {
      await expect(page.getByRole('dialog'), 'drawer closed after apply').not.toBeVisible();

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_UI_TEST));
      await expect(panel.locator('[data-testid="uplot-main-div"]'), 'panel rendered').toBeVisible();

      const legendItems = panel.locator('[data-testid*="VizLegend series"]');
      expect(await legendItems.count(), 'primary and comparison series rendered').toBeGreaterThanOrEqual(2);
    });
  });

  test('comparison series renders correctly alongside time shift', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await test.step('Load dashboard', async () => {
      return gotoDashboardPage({ uid: DASHBOARD_UID });
    });

    await test.step('Verify panel with timeCompare + timeFrom renders without errors', async () => {
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TIME_SHIFT));
      await panel.scrollIntoViewIfNeeded();

      await expect(panel.getByTestId('[data-testid="uplot-main-div"]'), 'panel rendered').toBeVisible();

      const errorBadge = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.headerCornerInfo('error')
      );
      await expect(errorBadge, 'no error on panel').not.toBeVisible();
    });

    await test.step('Verify both primary and comparison series are rendered', async () => {
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_TIME_SHIFT));
      const legendItems = panel.locator('[data-testid*="VizLegend series"]');
      expect(await legendItems.count(), 'primary and comparison series rendered').toBeGreaterThanOrEqual(2);
    });
  });

  test('comparison series stays visible after live refresh tick', async ({ gotoDashboardPage, page, selectors }) => {
    // Regression test: liveTimer advancing timeRange caused alignTimeRangeCompareData to
    // be applied multiple times on the same mutated frame, drifting the comparison series
    // off-screen. Fixed by guarding shouldAlignTimeCompare with isTimeShiftQuery sentinel.
    const dashboardPage = await test.step('Load live dashboard', async () => {
      return gotoDashboardPage({ uid: LIVE_DASHBOARD_UID });
    });

    await test.step('Verify comparison series is visible before live tick', async () => {
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_LIVE));
      await expect(panel.locator('[data-testid="uplot-main-div"]'), 'panel rendered').toBeVisible();

      const legendItems = panel.locator('[data-testid*="VizLegend series"]');
      expect(await legendItems.count(), 'comparison series present before live tick').toBeGreaterThanOrEqual(2);
    });

    await test.step('Wait for liveTimer to fire and verify series did not drift', async () => {
      // liveTimer polls at ~100ms; 500ms guarantees multiple ticks
      await page.waitForTimeout(500);

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_LIVE));

      const errorBadge = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.headerCornerInfo('error')
      );
      await expect(errorBadge, 'no error after live tick').not.toBeVisible();

      const legendItemsAfter = panel.locator('[data-testid*="VizLegend series"]');
      expect(await legendItemsAfter.count(), 'comparison series still present after live tick').toBeGreaterThanOrEqual(
        2
      );
    });
  });

  test('comparison series stays visible after manual dashboard refresh', async ({
    gotoDashboardPage,
    page,
    selectors,
  }) => {
    const dashboardPage = await test.step('Load dashboard and verify initial render', async () => {
      const dp = await gotoDashboardPage({ uid: DASHBOARD_UID });

      const panel = dp.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_DAY_BEFORE));
      await expect(panel.locator('[data-testid="uplot-main-div"]'), 'panel rendered').toBeVisible();

      const legendItemsInitial = panel.locator('[data-testid*="VizLegend series"]');
      expect(await legendItemsInitial.count(), 'comparison series present before refresh').toBeGreaterThanOrEqual(2);

      return dp;
    });

    await test.step('Trigger manual refresh and verify comparison series persists', async () => {
      await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_DAY_BEFORE));
      await expect(panel.locator('[data-testid="uplot-main-div"]'), 'panel re-rendered after refresh').toBeVisible();

      const errorBadge = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.headerCornerInfo('error')
      );
      await expect(errorBadge, 'no error after refresh').not.toBeVisible();

      const legendItemsAfterRefresh = panel.locator('[data-testid*="VizLegend series"]');
      expect(
        await legendItemsAfterRefresh.count(),
        'comparison series still present after refresh'
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
