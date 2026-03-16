import { Locator } from 'playwright';

import { DashboardPage, E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ad7p5pj';

test.use({ viewport: { width: 1000, height: 1440 }, featureToggles: { annotationsClustering: true } });

test.describe('Panels test: Annotations', { tag: ['@panels', '@annotations'] }, () => {
  test('Annotations should split into multiple rows if multi-lane panel option is set', async ({
    gotoDashboardPage,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams(),
    });

    await checkPanel('Time series', 'Time series (multi-lane)', dashboardPage, selectors);
    await checkPanel('Candlestick', 'Candlestick (multi-lane)', dashboardPage, selectors);
    await checkPanel('State timeline', 'State timeline (multi-lane)', dashboardPage, selectors);
    await checkPanel('Heatmap', 'Heatmap (multi-lane)', dashboardPage, selectors);
    await checkPanel('Status history', 'Status history (multi-lane)', dashboardPage, selectors);
  });
});

/**
 * Helper method to get the locators and populate the expected assertion counts
 * @param panelName
 * @param multiRowPanelName
 * @param dashboardPage
 * @param selectors
 */
const checkPanel = async (
  panelName: string,
  multiRowPanelName: string,
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups
) => {
  const annoLaneHeight = 7;
  const timeSeries = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelName));
  const timeSeriesLanes = dashboardPage.getByGrafanaSelector(
    selectors.components.Panels.Panel.title(multiRowPanelName)
  );
  // no top offset when multi-lane is not set
  await assertPanelHasAnnoCount(timeSeries, selectors, 28, undefined, 'all annotations are in the same lane');

  // multi-lane have top-offset
  await assertPanelHasAnnoCount(timeSeriesLanes, selectors, 0, undefined, 'all annotations have top offset');
  await assertPanelHasAnnoCount(
    timeSeriesLanes,
    selectors,
    6,
    `[style*="top: ${annoLaneHeight * 0}px"]`,
    '6 annotations are in the first lane'
  );
  await assertPanelHasAnnoCount(
    timeSeriesLanes,
    selectors,
    4,
    `[style*="top: ${annoLaneHeight * 1}px"]`,
    '4 annotations are in the 2nd lane'
  );
  await assertPanelHasAnnoCount(
    timeSeriesLanes,
    selectors,
    6,
    `[style*="top: ${annoLaneHeight * 2}px"]`,
    '6 annotations are in the 3rd lane'
  );
  await assertPanelHasAnnoCount(
    timeSeriesLanes,
    selectors,
    12,
    `[style*="top: ${annoLaneHeight * 3}px"]`,
    '12 annotations are in the 4th lane'
  );
};

/**
 * Inner helper method to assert the number of annotations for the provided DOM selector
 * @param panelLoc
 * @param selectors
 * @param annoCount
 * @param matcher
 * @param message
 */
const assertPanelHasAnnoCount = async (
  panelLoc: Locator,
  selectors: E2ESelectorGroups,
  annoCount: number,
  // By default we assert that all annos have no top offset
  matcher = ':not([style*="top"])',
  message: string
) => {
  const timeSeriesMarkersLocator = panelLoc.getByTestId(selectors.pages.Dashboard.Annotations.marker);
  await expect(panelLoc).toBeVisible();
  await expect(timeSeriesMarkersLocator, 'all annotations are in the viz').toHaveCount(28);

  // this is a pretty terrible way of figuring out which lane annos are rendered in, but it's also the only way
  const annotationsWithoutTop = panelLoc.locator(
    `[data-testid="${selectors.pages.Dashboard.Annotations.marker}"]${matcher}`
  );
  await expect(annotationsWithoutTop, message).toHaveCount(annoCount);
  return annotationsWithoutTop;
};
