import { type DashboardPage, type E2ESelectorGroups, expect, test } from '@grafana/plugin-e2e';

import { setupAnnotationApiMock } from '../utils/annotation-api-mock';

const DASHBOARD_UID = 'ad7p5pjk';

/**
 * test cases:
 *
 * Alert tooltips
 * Change viewport size, anno count should decrease
 */

const MANY_ANNOTATIONS_COUNTS = {
  frame1: {
    count: 224,
    widths: {
      '1000': 1,
      '2600': 6,
    },
  },
  frame2: {
    count: 235,
    widths: {
      '1000': 2,
      '2600': 15,
    },
  },
  frame3: {
    count: 2,
    widths: {
      '1000': 2,
      '2600': 2,
    },
  },
};
const REGION_ANNOTATIONS_COUNTS = {
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
      '1000': 2,
      '2600': 13,
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

test.use({
  viewport: { width: 1000, height: 1840 },
  featureToggles: { annotationsClustering: true, dashboardNewLayouts: false },
});

test.describe('Panels test: Clustering', { tag: ['@panels', '@annotations'] }, () => {
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
        MANY_ANNOTATIONS_COUNTS.frame1.count +
          MANY_ANNOTATIONS_COUNTS.frame2.count +
          MANY_ANNOTATIONS_COUNTS.frame3.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.count +
          MANY_ANNOTATIONS_COUNTS.frame2.count +
          MANY_ANNOTATIONS_COUNTS.frame3.count
      );

      await assertAnnotationCount(dashboardPage, selectors, 'Alert annos links', ALERT_ANNOTATIONS_COUNTS.frame1.count);

      // Enabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['1000'] +
          MANY_ANNOTATIONS_COUNTS.frame2.widths['1000'] +
          MANY_ANNOTATIONS_COUNTS.frame3.widths['1000']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['1000'] +
          MANY_ANNOTATIONS_COUNTS.frame2.widths['1000'] +
          MANY_ANNOTATIONS_COUNTS.frame3.widths['1000']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Alert annos clustering',
        ALERT_ANNOTATIONS_COUNTS.frame1.widths['1000']
      );

      // Regions
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Region clustering (off)',
        REGION_ANNOTATIONS_COUNTS.frame1.count + REGION_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Region clustering (on)',
        REGION_ANNOTATIONS_COUNTS.frame1.widths['1000'] + REGION_ANNOTATIONS_COUNTS.frame2.widths['1000']
      );
    });
  });
  test.describe('width: 2600', () => {
    test.use({ viewport: { width: 2600, height: 1440 } });
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
        MANY_ANNOTATIONS_COUNTS.frame1.count +
          MANY_ANNOTATIONS_COUNTS.frame2.count +
          MANY_ANNOTATIONS_COUNTS.frame3.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering disabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.count +
          MANY_ANNOTATIONS_COUNTS.frame2.count +
          MANY_ANNOTATIONS_COUNTS.frame3.count
      );

      await assertAnnotationCount(dashboardPage, selectors, 'Alert annos links', ALERT_ANNOTATIONS_COUNTS.frame1.count);

      // Enabled
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2600'] +
          MANY_ANNOTATIONS_COUNTS.frame2.widths['2600'] +
          MANY_ANNOTATIONS_COUNTS.frame3.widths['2600']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Clustering enabled w/ multi-row',
        MANY_ANNOTATIONS_COUNTS.frame1.widths['2600'] +
          MANY_ANNOTATIONS_COUNTS.frame2.widths['2600'] +
          MANY_ANNOTATIONS_COUNTS.frame3.widths['2600']
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Alert annos clustering',
        ALERT_ANNOTATIONS_COUNTS.frame1.widths['2600']
      );

      // Regions
      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Region clustering (off)',
        REGION_ANNOTATIONS_COUNTS.frame1.count + REGION_ANNOTATIONS_COUNTS.frame2.count
      );

      await assertAnnotationCount(
        dashboardPage,
        selectors,
        'Region clustering (on)',
        REGION_ANNOTATIONS_COUNTS.frame1.widths['2600'] + REGION_ANNOTATIONS_COUNTS.frame2.widths['2600']
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

    test.describe('wip annotations', () => {
      test.use({ viewport: { width: 1280, height: 700 } });

      test('can edit locally created (wip) annotations from the clustered tooltip', async ({
        page,
        gotoDashboardPage,
        selectors,
      }) => {
        // Mock annotation API to avoid shared DB state in parallel executions
        await setupAnnotationApiMock(page);

        const dashboardPage = await gotoDashboardPage({
          uid: DASHBOARD_UID,
          queryParams: new URLSearchParams({ editPanel: 'panel-18' }),
        });

        const panel = dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title('wip annotations panel')
        );

        await expect(panel, `Panel should be visible`).toBeVisible();

        // Meta click to create a wip annotation
        await panel.locator('.u-over').click({ position: { x: 100, y: 100 }, modifiers: ['Meta'] });

        const descriptionTextarea = page.getByTestId('annotation-editor-description');
        const tagsInput = page.getByText('Add tags');
        const markersLocator = page.getByTestId(selectors.pages.Dashboard.Annotations.marker);
        await expect(descriptionTextarea, 'add annotation description is visible').toBeVisible();
        await expect(tagsInput, 'should only be one tags input').toHaveCount(1);

        // add description
        await descriptionTextarea.fill('description text goes here');

        // add a tag
        await tagsInput.click();
        await page.keyboard.type('tag1');
        await page.keyboard.press('Enter');

        // save
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        // Assert saving has closed the modal before we create another one
        await expect(
          page.getByText('Add annotation'),
          'add annotation text is not rendered as the modal was removed after clicking save'
        ).toHaveCount(0);
        // assert annotation was created
        await expect(markersLocator, 'annotation marker is visible').toBeVisible();

        // add another anno
        await panel.locator('.u-over').click({ position: { x: 110, y: 100 }, modifiers: ['Meta'] });
        await expect(descriptionTextarea, 'add annotation description is visible').toBeVisible();
        await expect(tagsInput, 'should only be one tags input').toHaveCount(1);
        await descriptionTextarea.fill('description2 text goes here');

        await tagsInput.click();
        await page.keyboard.type('tag2');
        await page.keyboard.press('Enter');
        // save
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        // Assert saving has closed the modal before we create another one
        await expect(
          page.getByText('Add annotation'),
          'add annotation text is not rendered as the modal was removed after clicking save on the second annotation'
        ).toHaveCount(0);
        // assert we have 2 anno markers
        await expect(markersLocator, 'should be 2 markers visible').toHaveCount(2);

        // enable clustering
        await page.getByText('Enable annotation clustering').click();
        await expect(page.getByRole('switch', { name: 'Enable annotation clustering' })).toBeChecked();
        await expect(markersLocator, 'after enabling clustering only one marker should be visible').toHaveCount(1);
        await markersLocator.click();
        await expect(
          page.getByText('2 annotations'),
          'annotation count text should be in cluster tooltip'
        ).toBeVisible();

        // edit from cluster
        const tooltip = page.getByTestId(selectors.pages.Dashboard.Annotations.tooltip);
        await expect(tooltip.getByRole('button', { name: 'Edit' }).nth(0)).toBeVisible();
        await expect(tooltip.getByRole('button', { name: 'Edit' }).nth(1)).toBeVisible();

        await tooltip.getByRole('button', { name: 'Edit' }).nth(1).click();
        await expect(
          tooltip.getByText('Edit annotation'),
          'edit annotation text should be visible in tooltip'
        ).toBeVisible();
        await expect(
          tooltip.getByTestId('annotation-editor-description'),
          'second annotation textarea has unedited description'
        ).toHaveValue('description2 text goes here');

        await descriptionTextarea.fill('description2 text goes here - EDITED');
        await tooltip.getByRole('button', { name: 'Save', exact: true }).click();

        // Delete first anno
        await markersLocator.click();
        await expect(
          dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Annotations.clusterTooltip),
          'cluster tooltip is visible'
        ).toBeVisible();
        await expect(
          tooltip.getByText('description text goes here'),
          'annotation 1 description is visible in cluster tooltip'
        ).toBeVisible();
        await expect(
          tooltip.getByText('description2 text goes here - EDITED'),
          'annotation 2 edited description text is visible'
        ).toBeVisible();
        await expect(tooltip.getByText('tag1'), 'tag from anno 1 is visible').toBeVisible();
        await expect(tooltip.getByText('tag2'), 'tag from anno 2 is visible').toBeVisible();
        await tooltip.getByRole('button', { name: 'Delete' }).first().click();

        // assert that first anno was removed from API result before clicking again
        await expect
          .poll(async () => {
            await markersLocator.hover();
            return tooltip.getByText('tag1').count();
          }, 'annotation is removed after annotation GET is returned')
          .toEqual(0);

        await markersLocator.click();
        await expect(
          tooltip.getByText('description2 text goes here - EDITED'),
          'anno 2 edited text is visible'
        ).toBeVisible();
        await expect(tooltip.getByText('tag2'), 'anno 2 tag is visible').toBeVisible();
        await tooltip.getByRole('button', { name: 'Delete' }).first().click();

        await expect(markersLocator, 'should no longer be any annotations').toHaveCount(0);
      });

      // regression test for https://github.com/grafana/grafana/issues/122446
      test('annotations that return after panel query are rendered in correct position on x-axis', async ({
        page,
        gotoDashboardPage,
        selectors,
      }) => {
        // Mock annotation API to avoid shared DB state in parallel executions
        await setupAnnotationApiMock(page);

        const dashboardPage = await gotoDashboardPage({
          uid: DASHBOARD_UID,
          queryParams: new URLSearchParams({ viewPanel: 'panel-18' }),
        });

        const panel = dashboardPage.getByGrafanaSelector(
          selectors.components.Panels.Panel.title('wip annotations panel')
        );

        await expect(panel, `Panel should be visible`).toBeVisible();

        // Meta click to create a wip annotation
        await panel.locator('.u-over').click({ position: { x: 100, y: 100 }, modifiers: ['Meta'] });

        const descriptionTextarea = page.getByTestId('annotation-editor-description');
        const markersLocator = page.getByTestId(selectors.pages.Dashboard.Annotations.marker);

        // add description
        await descriptionTextarea.fill('description text goes here');

        // save
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        // Assert saving has closed the modal before we create another one
        await expect(
          page.getByText('Add annotation'),
          'add annotation text is not rendered as the modal was removed after clicking save'
        ).toHaveCount(0);

        // assert annotation was created
        await expect(markersLocator, 'annotation marker is visible').toBeVisible();

        await expect(markersLocator, 'annotation marker has left offset of 100').toHaveAttribute(
          'style',
          /left: 100px/
        );

        // Move time range backwards, annotation should now be on right half of screen
        await page.getByTestId(selectors.components.TimePicker.moveBackwardButton).click();

        // Assert that the marker was re-rendered after the annotation was re-queried
        // should greater than 100, is asserting the exact offset overstepping the bounds of this test?
        await expect
          .poll(() => {
            return markersLocator.first().getAttribute('style');
          })
          .toMatch(/left: 547px/);

        // Clean up annos
        const tooltip = page.getByTestId(selectors.pages.Dashboard.Annotations.tooltip);
        await markersLocator.click();
        await expect(tooltip.getByText('description text goes here'), 'anno 2 edited text is visible').toBeVisible();
        await tooltip.getByRole('button', { name: 'Delete' }).first().click();

        await expect(markersLocator, 'should no longer be any annotations').toHaveCount(0);
      });
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
