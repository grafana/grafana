import { DashboardPage, E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ad7p5pjk';

/**
 * test cases:
 *
 * Alert tooltips
 * Change viewport size, anno count should decrease
 */

const MANY_ANNOTATIONS_COUNTS = {
  frame1: {
    count: 223,
    widths: {
      '1000': 1,
      '2570': 5,
    },
  },
  frame2: {
    count: 235,
    widths: {
      '1000': 1,
      '2570': 15,
    },
  },
};
const ALERT_ANNOTATIONS_COUNTS = {
  frame1: {
    count: 11,
    widths: {
      '1000': 1,
      '2570': 1,
    },
  },
};

test.describe.only('Panels test: Clustering', { tag: ['@panels', '@annotations'] }, () => {
  test.describe('width: 1000', () => {
    test.use({ viewport: { width: 1000, height: 1440 } });
    test('Clustering status', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams(),
      });

      // Disabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled',
        MANY_ANNOTATIONS_COUNTS.frame1.count + MANY_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.count + MANY_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(dashboardPage, selectors, 'Alert annos links', ALERT_ANNOTATIONS_COUNTS.frame1.count);

      // Enabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['1000'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['1000']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['1000'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['1000']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Alert annos clustering',
        ALERT_ANNOTATIONS_COUNTS.frame1.widths['1000']
      );
    });
  });

  test.describe('width: 2570', () => {
    test.use({ viewport: { width: 2570, height: 1440 } });
    test('Clustering status', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams(),
      });

      // Disabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled',
        MANY_ANNOTATIONS_COUNTS.frame1.count + MANY_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.count + MANY_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(dashboardPage, selectors, 'Alert annos links', ALERT_ANNOTATIONS_COUNTS.frame1.count);

      // @todo sometimes flakes, increase time range?
      await page.pause();
      // Enabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2570'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['2570']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2570'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['2570']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Alert annos clustering',
        ALERT_ANNOTATIONS_COUNTS.frame1.widths['2570']
      );
    });
  });
});

const assertAnnotationCount = async (
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelName: string,
  expectedAnnotationCount: number
) => {
  const clusteringDisabled = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelName));
  await expect(clusteringDisabled, `${panelName} should be visible`).toBeVisible();
  const markersLocator = clusteringDisabled.getByTestId(selectors.pages.Dashboard.Annotations.marker);
  await expect(markersLocator, `${panelName} should have ${expectedAnnotationCount} annotations`).toHaveCount(
    expectedAnnotationCount
  );
};
