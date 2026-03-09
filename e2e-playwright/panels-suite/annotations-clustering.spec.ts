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
      '2600': 5,
    },
  },
  frame2: {
    count: 235,
    widths: {
      '1000': 1,
      '2600': 15,
    },
  },
};
const ALERT_ANNOTATIONS_COUNTS = {
  frame1: {
    count: 11,
    widths: {
      '1000': 1,
      '2600': 1,
    },
  },
};

test.describe('Panels test: Clustering', { tag: ['@panels', '@annotations'] }, () => {
  test.use({ viewport: { width: 1000, height: 1440 } });

  test.describe('width: 1000', () => {
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
  test.describe('width: 2600', () => {
    test.use({ viewport: { width: 2600, height: 1440 } });
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
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2600'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['2600']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2600'] + MANY_ANNOTATIONS_COUNTS.frame2.widths['2600']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Alert annos clustering',
        ALERT_ANNOTATIONS_COUNTS.frame1.widths['2600']
      );
    });
  });
  test.describe('tooltips', () => {
    test('should contain original tooltip content', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams(),
      });

      const clusteringDisabled = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Alert annos clustering')
      );
      await expect(clusteringDisabled, `Alert annos clustering should be visible`).toBeVisible();
      const markersLocator = clusteringDisabled.getByTestId(selectors.pages.Dashboard.Annotations.marker);
      await expect(markersLocator).toHaveCount(1);
      await markersLocator.click();
      const tooltip = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Annotations.clusterTooltip);
      await expect(tooltip).toBeVisible();

      // cluster header
      await expect(
        tooltip.getByText(/2025-10-02 \d\d:08:15 - 2025-10-02 \d\d:35:40/),
        'cluster header time range is visible'
      ).toBeVisible();
      await expect(tooltip.getByText('11 annotations'), 'cluster header annotation count is visible').toBeVisible();
      // alert specific text
      await expect(tooltip.getByText(/ALERTING2025-10-02 \d\d:08:15/), 'custom alert text is visible').toBeVisible();
      await expect(
        tooltip.getByRole('link', { name: 'loki-prod-020-writes-error' }),
        'html link is rendered'
      ).toBeVisible();
      // tags
      await expect(tooltip.getByText('squad:adaptive-telemetry'), 'annotation tag is visible').toBeVisible();
      await expect(tooltip.getByText('squad:loki'), 'annotation tag is visible').toHaveCount(3);
      await expect(tooltip.getByText('team_name:loki'), 'annotation tag is visible').toBeVisible();

      // More alert specific headers
      await expect(tooltip.getByText(/OK2025-10-02 \d\d:09/), 'custom alert text is visible').toBeVisible();
      await expect(tooltip.getByText(/PENDING2025-10-02 \d\d:26:38/), 'custom alert text is visible').toBeVisible();
      await expect(tooltip.getByText(/NO DATA2025-10-02 \d\d:26:39/), 'custom alert text is visible').toBeVisible();
      await expect(tooltip.getByText(/RECOVERING2025-10-02 \d\d:27:00/), 'custom alert text is visible').toBeVisible();
      await expect(tooltip.getByText(/ERROR2025-10-02 \d\d:35:40/), 'custom alert text is visible').toBeVisible();
    });
  });
  test.describe('wip', () => {
    test('other tooltips are not hoverable when clustered tooltip is pinned', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams(),
      });

      const alertAnnotationClusteredPanel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Alert annos clustering')
      );

      await expect(alertAnnotationClusteredPanel, `Panel should be visible`).toBeVisible();
      const markersLocator = alertAnnotationClusteredPanel.getByTestId(selectors.pages.Dashboard.Annotations.marker);
      await expect(markersLocator).toHaveCount(1);

      // Create wip annotation
      await alertAnnotationClusteredPanel.click({ modifiers: ['Meta'] });
      await expect(markersLocator).toHaveCount(2);
      const tooltip = page.getByTestId(selectors.pages.Dashboard.Annotations.tooltip);

      // Verify edit/wip tooltip has required fields
      await expect(tooltip).toBeVisible();
      await expect(tooltip.getByText('Add annotation')).toBeVisible();
      await expect(tooltip.getByTestId('annotation-editor-description')).toBeVisible();
      await expect(tooltip.getByText('Add tags')).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Close' })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Cancel' })).toBeVisible();
      await expect(tooltip.getByRole('button', { name: 'Save' })).toBeVisible();

      // Hovering over another annotation while the wip editor view is present will not render an additional tooltip
      await markersLocator.first().hover();
      await expect(tooltip).toHaveCount(1);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Annotations.clusterTooltip)
      ).toHaveCount(0);

      await tooltip.getByRole('button', { name: 'Close' }).click();
      await expect(tooltip).toHaveCount(0);
    });
    // @todo annotations API doesn't care about provisioned dashboards, so any changes that are made in one e2e test in that API will pollute the data from any others in the same runner, we probably want to create a dedicated panel for testing the annotation API which is not used by any other tests
    // test.todo('can edit locally created (wip) annotations from the clustered tooltip')
    // test.todo('can delete locally created (wip) annotations from the clustered tooltip')
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
