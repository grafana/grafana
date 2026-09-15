import { test, expect } from '@grafana/plugin-e2e';

import { type EmptyResponseShape, mockQueryApi, seriesLabelFor } from './time-compare-utils';

const DASHBOARD_UID = 'time-compare-example';

/**
 * Pinned absolute range, so every expected timestamp below is a frozen literal rather than a value
 * recomputed from the request under test. A relative range would also make the assertions depend on
 * wall-clock time and on date-math rounding.
 */
const RANGE_FROM = 1757000000000;
const RANGE_TO = 1757021600000;
const ONE_DAY_MS = 86_400_000;

/** A second pinned range, used to assert a re-query keeps the comparison offset. */
const SHIFTED_RANGE_FROM = 1756900000000;
const SHIFTED_RANGE_TO = 1756921600000;

const pinnedRange = (from: number, to: number) =>
  new URLSearchParams({ from: String(from), to: String(to), timezone: 'utc' });

// Both flags are LegacyFrontend in the feature registry
test.use({
  featureToggles: {
    panelTimeSettings: true,
    timeComparison: true,
  },
});

test.describe('Panels test: Time Comparison', { tag: ['@panels', '@timeseries'] }, () => {
  test('issues a second query with a -compare refId when timeCompare is set', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const recorder = await mockQueryApi(page, selectors);
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: pinnedRange(RANGE_FROM, RANGE_TO) });

    const primary = await recorder.waitForRequest(['A']);
    const compare = await recorder.waitForRequest(['A-compare']);

    expect(primary.refIds).toEqual(['A']);
    expect(compare.refIds).toEqual(['A-compare']);
  });

  test('shifts the compare query time range back by exactly the compare offset', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const recorder = await mockQueryApi(page, selectors);
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
    const recorder = await mockQueryApi(page, selectors);
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: pinnedRange(RANGE_FROM, RANGE_TO),
    });

    // Gate on the control panel's own query and on the comparison fan-out of a sibling panel, so
    // "no B-compare" is asserted only once compare queries are demonstrably being issued.
    await recorder.waitForRequest(['B']);
    await recorder.waitForRequest(['A-compare']);
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Compare disabled'))
    ).toBeVisible();

    const compareRefIds = recorder.requests
      .flatMap((request) => request.refIds)
      .filter((refId) => refId.endsWith('-compare'));
    expect(compareRefIds).not.toContain('B-compare');
  });

  test('excludes a query that opted out via timeRangeCompare from the compare request', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const recorder = await mockQueryApi(page, selectors);
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: pinnedRange(RANGE_FROM, RANGE_TO) });

    // The panel queries C and D together; only C opts in to comparison.
    await recorder.waitForRequest(['C', 'D']);
    const compare = await recorder.waitForRequest(['C-compare']);

    expect(compare.refIds).toEqual(['C-compare']);
    expect(compare.from).toBe(1756913600000);
  });

  test('re-issues the primary and compare queries with the offset preserved when the time range changes', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const recorder = await mockQueryApi(page, selectors);
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: pinnedRange(RANGE_FROM, RANGE_TO) });
    await recorder.waitForRequest(['A-compare']);

    recorder.reset();
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: pinnedRange(SHIFTED_RANGE_FROM, SHIFTED_RANGE_TO),
    });

    const primary = await recorder.waitForRequest(['A']);
    const compare = await recorder.waitForRequest(['A-compare']);

    expect(primary.from).toBe(1756900000000);
    expect(compare.from).toBe(1756813600000);
    expect(compare.to).toBe(1756835200000);
    expect(primary.from - compare.from).toBe(ONE_DAY_MS);
  });

  test.describe('asymmetric data', () => {
    test('renders comparison series in the visible range when the primary query returns no data (#132370)', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      // The comparison frames arrive on their own, spanning the shifted request window - a day
      // behind the visible range. Unshifted they fall outside it and the panel renders the
      // outside-range fallback instead of the series, which is the symptom users reported.
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
      await expect(panel.locator('.u-over')).toBeVisible();

      // Shifted onto the visible range, and still identifiable as comparison data: the dashed
      // legend icon comes from the lineStyle alignTimeRangeCompareData applies.
      const legend = panel.getByTestId(selectors.components.VizLegend.legend);
      await expect(
        legend.getByRole('button', { name: `${seriesLabelFor('E')} (comparison)`, exact: true })
      ).toBeVisible();
      await expect(legend.getByTestId('series-icon')).toHaveCSS('background-size', '6px 4px');

      await expect(panel.getByTestId('time-series-zoom-to-data')).toBeHidden();
    });

    /**
     * A datasource can report an empty comparison window either way, and the two take different
     * branches through timeShiftAlignmentProcessor: with no frames at all it synthesizes
     * placeholders from the request targets, which carry no fields and so never reach the legend,
     * whereas a declared-but-empty frame keeps its fields and does get a (pointless) legend entry.
     * The notice is the contract both share.
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
        await expect(legend.getByRole('button', { name: seriesLabelFor('F'), exact: true })).toBeVisible();

        // The notice text is only rendered once its tooltip opens, so hover the icon to read it.
        const notice = panel.getByTestId(selectors.components.Panels.Panel.headerNotice('info'));
        await expect(notice).toBeVisible();
        await notice.hover();
        await expect(page.getByTestId(selectors.components.Tooltip.container)).toHaveText(
          'No data returned for time comparison'
        );

        const comparisonLegendItem = legend.getByRole('button', {
          name: `${seriesLabelFor('F')} (comparison)`,
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
