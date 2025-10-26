import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'P2jR04WVk';

const MAP_LAYERS_TYPE = 'Map layers Layer type';
const MAP_LAYERS_DATA = 'Map layers Data';
const MAP_LAYERS_GEOJSON = 'Map layers GeoJSON URL';

test.describe(
  'Panels test: Geomap layer types',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests changing the layer type', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_ID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toBeVisible();
      const field = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE)
      );
      await expect(field).toBeVisible();
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('markers');

      // Heatmap
      const input = field.locator('input');
      await input.fill('Heatmap');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('heatmap');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA))
      ).toBeVisible();

      // GeoJSON
      await input.fill('GeoJSON');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('geojson');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON))
      ).toBeVisible();

      // Open Street Map
      await input.fill('Open Street Map');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('osm-standard');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA))
      ).toBeHidden();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON))
      ).toBeHidden();

      // CARTO basemap
      await input.fill('CARTO basemap');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('carto');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show labels')
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Theme'))
      ).toBeVisible();

      // ArcGIS MapServer
      await input.fill('ArcGIS MapServer');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('esri-xyz');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Server instance')
        )
      ).toBeVisible();

      // XYZ Tile layer
      await input.fill('XYZ Tile layer');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('xyz');
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers URL template')
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Attribution')
        )
      ).toBeVisible();

      // Night / Day (Alpha)
      await input.fill('Night / Day');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('dayNight');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Show'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Night region color')
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Display sun')
        )
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

      // Route (Alpha)
      await input.fill('Route');
      await input.press('Enter');
      await expect(page.locator('[data-testid="layer-drag-drop-list"]')).toContainText('route');
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_DATA))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Location Mode')
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Map layers Style'))
      ).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    });
  }
);
