import { test, expect } from '@grafana/plugin-e2e';

import { drawnLegend, type EmptyResponseShape, mockQueryApi, observeQueryApi } from './time-compare-utils';

const DASHBOARD_UID = 'time-compare-example';

/**
 * Pin a range for less flake
 */
const RANGE_FROM = 1757000000000;
const RANGE_TO = 1757021600000;
const ONE_DAY_MS = 86_400_000;

/** A second pinned range, used to assert a re-query keeps the comparison offset. */
const SHIFTED_RANGE_FROM = 1756900000000;
const SHIFTED_RANGE_TO = 1756921600000;

const pinnedRange = (from: number, to: number) =>
  new URLSearchParams({ from: String(from), to: String(to), timezone: 'utc' });

/**
 * A rolling range re-resolves against the wall clock on every refresh, so its timestamps cannot be
 * frozen. Tests using it assert the offset between the two windows rather than absolute values.
 * 5s is the shortest interval the default `min_refresh_interval` permits.
 */
const rollingRange = () => new URLSearchParams({ from: 'now-6h', to: 'now', timezone: 'utc', refresh: '5s' });

// Both flags are LegacyFrontend in the feature registry
test.use({
  featureToggles: {
    panelTimeSettings: true,
    timeComparison: true,
  },
});

test.describe('Panels test: Time Comparison', { tag: ['@panels', '@timeseries'] }, () => {
  /**
   * Responses come from gdev-testdata. Nothing here is intercepted, so a compare request that is
   * built correctly but whose response never reaches the panel still fails.
   */
  test.describe('When both series and compare data exists', () => {
    test('issues a second query with a -compare refId when timeCompare is set', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const recorder = observeQueryApi(page);
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
      });

      const primary = await recorder.waitForRequest(['A']);
      const compare = await recorder.waitForRequest(['A-compare']);

      expect(primary.refIds).toEqual(['A']);
      expect(compare.refIds).toEqual(['A-compare']);

      // Both responses have to survive the round trip and reach the viz, not just be requested.
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Compare enabled'));
      const legend = await drawnLegend(panel, selectors);
      await expect(legend.getByRole('button', { name: 'A-series', exact: true })).toBeVisible();
      await expect(legend.getByRole('button', { name: 'A-compare-series (comparison)', exact: true })).toBeVisible();
    });

    test('shifts the compare query time range back by exactly the compare offset', async ({
      page,
      gotoDashboardPage,
    }) => {
      const recorder = observeQueryApi(page);
      await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: pinnedRange(RANGE_FROM, RANGE_TO) });

      const primary = await recorder.waitForRequest(['A']);
      const compare = await recorder.waitForRequest(['A-compare']);

      expect(primary.from).toBe(1757000000000);
      expect(primary.to).toBe(1757021600000);
      // The dashboard configures a 1d comparison, so the window moves back exactly 86_400_000ms.
      expect(compare.from).toBe(1756913600000);
      expect(compare.to).toBe(1756935200000);
      expect(primary.from - compare.from).toBe(ONE_DAY_MS);
    });

    test('does not issue a compare query for a panel without timeCompare', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const recorder = observeQueryApi(page);
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
      });

      // Gate on the control panel's own query and on the comparison fan-out of a sibling panel, so
      // "no B-compare" is asserted only once compare queries are demonstrably being issued.
      await recorder.waitForRequest(['B']);
      await recorder.waitForRequest(['A-compare']);

      const compareRefIds = recorder.requests
        .flatMap((request) => request.refIds)
        .filter((refId) => refId.endsWith('-compare'));
      expect(compareRefIds).not.toContain('B-compare');

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Compare disabled'));
      const legend = await drawnLegend(panel, selectors);
      await expect(legend.getByRole('button', { name: 'B-series', exact: true })).toBeVisible();
      await expect(legend.getByRole('button', { name: 'B-compare-series (comparison)', exact: true })).toBeHidden();
    });

    test('excludes a query that opted out via timeRangeCompare from the compare request', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const recorder = observeQueryApi(page);
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
      });

      // The panel queries C and D together; only C opts in to comparison.
      await recorder.waitForRequest(['C', 'D']);
      const compare = await recorder.waitForRequest(['C-compare']);

      expect(compare.refIds).toEqual(['C-compare']);
      expect(compare.from).toBe(1756913600000);

      // The opt-out has to hold all the way to the viz, not just in the request.
      const panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Compare with per-query opt-out')
      );
      const legend = await drawnLegend(panel, selectors);
      await expect(legend.getByRole('button', { name: 'C-series', exact: true })).toBeVisible();
      await expect(legend.getByRole('button', { name: 'D-series', exact: true })).toBeVisible();
      await expect(legend.getByRole('button', { name: 'C-compare-series (comparison)', exact: true })).toBeVisible();
      await expect(legend.getByRole('button', { name: 'D-compare-series (comparison)', exact: true })).toBeHidden();
    });

    test('re-issues the primary and compare queries with the offset preserved when the time range changes', async ({
      page,
      gotoDashboardPage,
    }) => {
      const recorder = observeQueryApi(page);
      await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: pinnedRange(RANGE_FROM, RANGE_TO) });
      await recorder.waitForRequest(['A-compare']);

      recorder.reset();
      await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(SHIFTED_RANGE_FROM, SHIFTED_RANGE_TO),
      });

      const primary = await recorder.waitForRequest(['A']);
      const compare = await recorder.waitForRequest(['A-compare'], { after: primary });

      expect(primary.from).toBe(1756900000000);
      expect(compare.from).toBe(1756813600000);
      expect(compare.to).toBe(1756835200000);
      expect(primary.from - compare.from).toBe(ONE_DAY_MS);
    });

    test('rolls the compare window forward with the primary one when a relative range auto-refreshes', async ({
      page,
      gotoDashboardPage,
    }) => {
      // Waits out a real auto-refresh tick on top of the dashboard load.
      test.slow();

      const recorder = observeQueryApi(page);
      await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: rollingRange() });

      const firstPrimary = await recorder.waitForRequest(['A']);
      const firstCompare = await recorder.waitForRequest(['A-compare'], { after: firstPrimary });

      expect(firstCompare.from).toBe(firstPrimary.from - ONE_DAY_MS);
      expect(firstCompare.to).toBe(firstPrimary.to - ONE_DAY_MS);

      // Drop the load's requests so the next ones can only have come from the refresh.
      recorder.reset();

      // If the reset above happened between a refresh's primary and compare, the leftover compare
      // would be matched here against the next refresh's primary, and the offset checks below would
      // be out by one refresh interval. Anchoring the compare to this primary avoids that.
      const nextPrimary = await recorder.waitForRequest(['A']);
      const nextCompare = await recorder.waitForRequest(['A-compare'], { after: nextPrimary });

      // `now` advanced, so both windows have to advance with it. A comparison window pinned to the
      // range resolved at load time would still satisfy the offset assertions below.
      expect(nextPrimary.to).toBeGreaterThan(firstPrimary.to);
      expect(nextCompare.to).toBeGreaterThan(firstCompare.to);

      expect(nextCompare.from).toBe(nextPrimary.from - ONE_DAY_MS);
      expect(nextCompare.to).toBe(nextPrimary.to - ONE_DAY_MS);
    });

    test('enables comparison on a panel through the time settings drawer', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      const recorder = observeQueryApi(page);
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
      });

      // 'Compare disabled' is the one fixture panel with no query options at all, so applying the
      // drawer has to build its panel time range from scratch rather than amend an existing one.
      await recorder.waitForRequest(['B']);

      await dashboardPage
        .getByGrafanaSelector(selectors.components.Panels.Panel.menu('Compare disabled'))
        .click({ force: true });
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Time settings')).click();

      const drawer = dashboardPage.getByGrafanaSelector(
        selectors.components.Drawer.General.title('Panel time settings')
      );
      const compareSelect = drawer.getByTestId(selectors.components.Drawer.PanelTimeRangeDrawer.timeComparisonSelect);
      // Seeded from the panel, which has no comparison configured.
      await expect(compareSelect).toHaveValue('Disabled');

      await compareSelect.click();
      // The option list renders in a portal, so it is anchored to the listbox rather than the drawer.
      await page.getByRole('listbox').getByRole('option', { name: 'Day before' }).click();
      await expect(compareSelect).toHaveValue('Day before');

      await drawer.getByRole('button', { name: 'Apply' }).click();

      const compare = await recorder.waitForRequest(['B-compare']);
      expect(compare.from).toBe(1756913600000);
      expect(compare.to).toBe(1756935200000);

      // The panel header gains the time override indicator, which is also the control that reopens
      // the drawer.
      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Compare disabled'));
      await expect(panel.getByRole('button', { name: 'Compared to day before' })).toBeVisible();

      // Applying the drawer has to produce rendered comparison data, not just a request.
      const legend = await drawnLegend(panel, selectors);
      await expect(legend.getByRole('button', { name: 'B-compare-series (comparison)', exact: true })).toBeVisible();
    });
  });

  /**
   * Tests in this block use the mocked API. If a test is for both compare and series data, it goes above.
   */
  test.describe('When only compare or series data exists', () => {
    test('renders comparison series in the visible range when the primary query returns no data (#132370)', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      // The comparison frames (-1d) arrive on their own, spanning the shifted request window
      const recorder = await mockQueryApi(page, selectors, { emptyRefIds: { E: 'no-frames' } });
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
      });

      // Both queries ran; the primary genuinely returned nothing rather than being skipped.
      await recorder.waitForRequest(['E']);
      const compare = await recorder.waitForRequest(['E-compare']);
      expect(compare.from).toBe(1756913600000);

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Comparison only'));

      // The outside-range fallback only mounts once uPlot has drawn and reported its x scale, so
      // asserting its absence before that would pass no matter what the panel did.
      const legend = await drawnLegend(panel, selectors);

      // Shifted onto the visible range, and still identifiable as comparison data.
      await expect(legend.getByRole('button', { name: 'E-compare-series (comparison)', exact: true })).toBeVisible();

      await expect(panel.getByTestId('time-series-zoom-to-data')).toBeHidden();
    });

    /**
     * Test both ways a datasource can return an empty comparison window
     */
    const emptyShapes: Array<{ shape: EmptyResponseShape; desc: string; comparisonInLegend: boolean }> = [
      { shape: 'no-frames', desc: 'no frames at all', comparisonInLegend: false },
      { shape: 'empty-frame', desc: 'a frame with no points', comparisonInLegend: true },
    ];

    for (const { shape, desc, comparisonInLegend } of emptyShapes) {
      test(`shows an info notice when the comparison query returns ${desc} (#126825)`, async ({
        page,
        gotoDashboardPage,
        selectors,
      }) => {
        const recorder = await mockQueryApi(page, selectors, { emptyRefIds: { 'F-compare': shape } });
        const dashboardPage = await gotoDashboardPage({
          uid: DASHBOARD_UID,
          queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
        });

        await recorder.waitForRequest(['F']);
        await recorder.waitForRequest(['F-compare']);

        const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Empty comparison'));
        const legend = panel.getByTestId(selectors.components.VizLegend.legend);

        // The primary rendering is the precondition for the notice: it is only raised when the
        // primary has data and the comparison does not.
        await expect(legend.getByRole('button', { name: 'F-series', exact: true })).toBeVisible();

        // The notice text is only rendered once its tooltip opens, so hover the icon to read it.
        const notice = panel.getByTestId(selectors.components.Panels.Panel.headerNotice('info'));
        await expect(notice).toBeVisible();
        await notice.hover();
        await expect(page.getByTestId(selectors.components.Tooltip.container)).toHaveText(
          'No data returned for time comparison'
        );

        const comparisonLegendItem = legend.getByRole('button', {
          name: 'F-compare-series (comparison)',
          exact: true,
        });
        if (comparisonInLegend) {
          await expect(comparisonLegendItem).toBeVisible();
        } else {
          await expect(comparisonLegendItem).toBeHidden();
        }
      });
    }
  });
});
