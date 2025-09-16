import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'P2jR04WVk';

test.describe(
  'Panels test: Geomap layer controls options',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests map controls options', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_ID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      // Wait until the query editor has been loaded by ensuring that the QueryEditor select contains the text 'flight_info_by_state.csv'
      await expect(
        page.locator(selectors.components.Select.singleValue('')).getByText('flight_info_by_state.csv')
      ).toBeVisible();

      const mapControlsGroup = dashboardPage.getByGrafanaSelector(
        selectors.components.OptionsGroup.group('Map controls')
      );
      await expect(mapControlsGroup).toBeVisible();

      // Show zoom field
      const showZoomField = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.showZoomField);
      await expect(showZoomField).toBeVisible();
      const zoomCheckbox = showZoomField.locator('input[type="checkbox"]');
      await zoomCheckbox.check({ force: true });
      await expect(zoomCheckbox).toBeChecked();

      // Show attribution
      const showAttributionField = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.showAttributionField
      );
      await expect(showAttributionField).toBeVisible();
      const attributionCheckbox = showAttributionField.locator('input[type="checkbox"]');
      await attributionCheckbox.check({ force: true });
      await expect(attributionCheckbox).toBeChecked();

      // Show scale
      const showScaleField = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.showScaleField);
      await expect(showScaleField).toBeVisible();
      const scaleCheckbox = showScaleField.locator('input[type="checkbox"]');
      await scaleCheckbox.check({ force: true });
      await expect(scaleCheckbox).toBeChecked();

      // Show measure tool
      const showMeasureField = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.showMeasureField);
      await expect(showMeasureField).toBeVisible();
      const measureCheckbox = showMeasureField.locator('input[type="checkbox"]');
      await measureCheckbox.check({ force: true });
      await expect(measureCheckbox).toBeChecked();

      // Show debug
      const showDebugField = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.showDebugField);
      await expect(showDebugField).toBeVisible();
      const debugCheckbox = showDebugField.locator('input[type="checkbox"]');
      await debugCheckbox.check({ force: true });
      await expect(debugCheckbox).toBeChecked();

      const panelContent = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
      await expect(panelContent).toBeVisible();

      // Verify zoom
      await expect(panelContent.locator('.ol-zoom')).toBeVisible();

      // Verify attribution
      await expect(panelContent.locator('.ol-attribution')).toBeVisible();

      // Verify scale
      await expect(panelContent.locator('.ol-scale-line')).toBeVisible();

      // Verify measure tool
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.measureButton)).toBeVisible();

      // Verify debug tool
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.DebugOverlay.wrapper)).toBeVisible();
    });
  }
);
