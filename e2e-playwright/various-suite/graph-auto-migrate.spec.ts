import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'XMjIZPmik';
const DASHBOARD_NAME = 'Panel Tests - Graph Time Regions';
const UPLOT_MAIN_DIV_SELECTOR = 'uplot-main-div';
const ANNOTATION_MARKER_SELECTOR = 'data-testid annotation-marker';

test.describe(
  'Auto-migrate graph panel',
  {
    tag: ['@various'],
  },
  () => {
    test('Graph panel is auto-migrated', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({ uid: DASHBOARD_ID });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      await expect(page.getByTestId(UPLOT_MAIN_DIV_SELECTOR).first()).toBeHidden();

      await gotoDashboardPage({ uid: DASHBOARD_ID });

      await expect(page.getByTestId(UPLOT_MAIN_DIV_SELECTOR).first()).toBeVisible();
    });

    test('Annotation markers exist for time regions', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_ID });
      await expect(page.getByText(DASHBOARD_NAME)).toBeVisible();
      await expect(page.getByTestId(UPLOT_MAIN_DIV_SELECTOR).first()).toBeHidden();

      await gotoDashboardPage({ uid: DASHBOARD_ID });

      // Check Business Hours panel
      const businessHoursPanel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Business Hours')
      );
      await expect(businessHoursPanel).toBeVisible();
      const businessHoursMarker = businessHoursPanel.getByTestId(ANNOTATION_MARKER_SELECTOR).first();
      await expect(businessHoursMarker).toBeVisible();

      // Check Sunday's 20-23 panel
      const sundayPanel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title("Sunday's 20-23"));
      await expect(sundayPanel).toBeVisible();
      const sundayMarker = sundayPanel.getByTestId(ANNOTATION_MARKER_SELECTOR).first();
      await expect(sundayMarker).toBeVisible();

      // Check Each day of week panel
      const eachDayPanel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Each day of week')
      );
      await expect(eachDayPanel).toBeVisible();
      const eachDayMarker = eachDayPanel.getByTestId(ANNOTATION_MARKER_SELECTOR).first();
      await expect(eachDayMarker).toBeVisible();

      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Check 05:00 panel
      const timePanel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('05:00'));
      await expect(timePanel).toBeVisible();
      const timeMarker = timePanel.getByTestId(ANNOTATION_MARKER_SELECTOR).first();
      await expect(timeMarker).toBeVisible();

      // Check From 22:00 to 00:30 panel
      const midnightPanel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('From 22:00 to 00:30 (crossing midnight)')
      );
      await expect(midnightPanel).toBeVisible();
      const midnightMarker = midnightPanel.getByTestId(ANNOTATION_MARKER_SELECTOR).first();
      await expect(midnightMarker).toBeVisible();
    });
  }
);
