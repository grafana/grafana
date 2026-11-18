import { type Locator, type Page } from '@playwright/test';

import { type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ad7p5pj';

// "wip annotations panel" plots a static CSV with a point at 2025-10-02 10:57:59 UTC.
const LOAD_ORDER_DASHBOARD_UID = 'ad7p5pjk';
const LOAD_ORDER_PANEL_KEY = 'panel-18';
const LOAD_ORDER_PANEL_TITLE = 'wip annotations panel';
// Outside 10:30-11:30, inside the 10:00-12:00 range that one zoom out gives.
const ANNOTATION_TIME = Date.UTC(2025, 9, 2, 10, 10);

test.use({ viewport: { width: 1000, height: 1440 } });

test.describe('Panels test: Annotations', { tag: ['@panels', '@annotations'] }, () => {
  test('renders a marker after zooming out from a range without annotations, when the plot drew before annotations loaded', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    // Hold the first annotation response until the plot exists, so the plot is built with no annotations.
    const firstAnnotations = gate();
    let annotationRequests = 0;
    await page.route(/\/api\/annotations(\?|$)/, async (route) => {
      annotationRequests++;
      if (annotationRequests === 1) {
        await firstAnnotations.wait;
      }
      await route.fulfill({
        json: [
          {
            id: 1,
            dashboardUID: LOAD_ORDER_DASHBOARD_UID,
            panelId: 0,
            time: ANNOTATION_TIME,
            text: 'annotation at 10:10',
            tags: [],
          },
        ],
      });
    });

    // After the zoom, hold the panel data until the annotations have rendered, so they render against the old x range.
    const dataAfterZoom = gate();
    let holdData = false;
    await page.route(/\/api\/ds\/query/, async (route) => {
      if (!holdData) {
        return route.fallback();
      }
      const response = await route.fetch();
      await dataAfterZoom.wait;
      await route.fulfill({ response });
    });

    const dashboardPage = await gotoDashboardPage({
      uid: LOAD_ORDER_DASHBOARD_UID,
      queryParams: new URLSearchParams({
        viewPanel: LOAD_ORDER_PANEL_KEY,
        from: '2025-10-02T10:30:00.000Z',
        to: '2025-10-02T11:30:00.000Z',
        timezone: 'utc',
      }),
    });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(LOAD_ORDER_PANEL_TITLE));
    const markers = panel.getByTestId(selectors.pages.Dashboard.Annotations.marker);

    await expect(panel.locator('.u-over'), 'plot is drawn before annotations load').toBeVisible();
    const firstAnnotationsResponse = page.waitForResponse(/\/api\/annotations(\?|$)/);
    firstAnnotations.release();
    await firstAnnotationsResponse;
    await nextFrame(page);
    await expect(markers, 'annotation is outside the initial range').toHaveCount(0);

    holdData = true;
    const zoomedAnnotationsResponse = page.waitForResponse(/\/api\/annotations(\?|$)/);
    await dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.zoomOut).click();
    await zoomedAnnotationsResponse;
    await nextFrame(page);
    dataAfterZoom.release();

    await expect(markers, 'annotation is inside the zoomed-out range').toHaveCount(1);
  });

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
 * A promise the test resolves to let a held route response through.
 */
const gate = () => {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
};

/**
 * Waits for the browser to paint, so React has committed the render that the last response caused.
 */
const nextFrame = (page: Page) =>
  page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

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
