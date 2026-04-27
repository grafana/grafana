import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'P2jR04WVk';

const MAP_LAYERS_TYPE = 'Map layers Layer type';
const MAP_LAYERS_DATA = 'Map layers Data';
const MAP_LAYERS_GEOJSON = 'Map layers GeoJSON URL';
const AIRPORTS_GEOJSON_URL = 'public/gazetteer/airports.geojson';

type SetupFixtures = Pick<Parameters<Parameters<typeof test>[2]>[0], 'gotoDashboardPage' | 'selectors' | 'page'>;

async function setupGeomapWithAirportsGeoJSON({ gotoDashboardPage, selectors, page }: SetupFixtures) {
  const dashboardPage = await gotoDashboardPage({});
  await dashboardPage.addPanel();

  // Select Geomap visualization — handle case where viz picker may be auto-opened
  const vizPicker = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);
  if (await vizPicker.filter({ hasText: 'Back' }).isVisible()) {
    await vizPicker.click({ force: true });
  }
  await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Visualizations')).click();
  await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item('Geomap')).click();
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header)
  ).toHaveText('Geomap', { timeout: 10000 });

  // Switch the map layer type to GeoJSON
  const layerTypeField = dashboardPage.getByGrafanaSelector(
    selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_TYPE)
  );
  const layerTypeInput = layerTypeField.locator('input');
  await layerTypeInput.fill('GeoJSON');
  await layerTypeInput.press('Enter');
  await expect(
    dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON))
  ).toBeVisible();

  // Select airports.geojson as the data source (contains Point features)
  const geojsonUrlInput = dashboardPage
    .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(MAP_LAYERS_GEOJSON))
    .locator('input');
  await geojsonUrlInput.fill(AIRPORTS_GEOJSON_URL);
  const airportsOption = page.getByText(AIRPORTS_GEOJSON_URL, { exact: true }).first();
  if (await airportsOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await airportsOption.click();
  } else {
    await geojsonUrlInput.press('Enter');
  }

  return dashboardPage;
}

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

    test('ResourcePicker in GeoJSON Default style - select icon from marker set', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      await setupGeomapWithAirportsGeoJSON({ gotoDashboardPage, selectors, page });

      // airports.geojson contains Point features — wait for the Symbol field to appear
      // (StyleEditor only shows Symbol when the layer detects point geometry)
      const symbolInput = page.getByPlaceholder(/select a symbol/i);
      await expect(symbolInput).toBeVisible({ timeout: 15000 });

      // Open the ResourcePickerPopover by clicking the symbol input
      await symbolInput.click();

      // Verify the popover opened (Folder tab is active by default for non-URL values)
      const resourcePickerDialog = page.getByRole('dialog');
      await expect(resourcePickerDialog).toBeVisible();

      // Filter to x-mark (in the default img/icons/marker folder)
      await resourcePickerDialog.getByPlaceholder('Search').fill('x-mark');
      await resourcePickerDialog.getByRole('button', { name: 'x-mark' }).click();

      // Confirm the selection
      await resourcePickerDialog.getByRole('button', { name: 'Select' }).click();
      await expect(resourcePickerDialog).toBeHidden();

      // Verify the symbol input now reflects the selected icon
      await expect(symbolInput).toHaveValue('x-mark');

      // Re-open the picker to confirm the selected value is preserved
      await symbolInput.click();
      const dialog2 = page.getByRole('dialog');
      await expect(dialog2).toBeVisible();
      await dialog2.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    });

    // This test documents a known bug on this branch: switching the icon folder inside
    // the ResourcePickerPopover and picking from the new folder does not persist correctly.
    test('ResourcePicker in GeoJSON Default style - switching icon folder', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      await setupGeomapWithAirportsGeoJSON({ gotoDashboardPage, selectors, page });

      const symbolInput = page.getByPlaceholder(/select a symbol/i);
      await expect(symbolInput).toBeVisible({ timeout: 15000 });
      await symbolInput.click();

      const resourcePickerDialog = page.getByRole('dialog');
      await expect(resourcePickerDialog).toBeVisible();

      // Switch from the default img/icons/marker folder to img/icons/unicons
      await resourcePickerDialog.getByRole('combobox').click();
      await page.getByText('img/icons/unicons', { exact: true }).click();

      // Pick an icon from the new folder
      await resourcePickerDialog.getByPlaceholder('Search').fill('0-plus');
      await resourcePickerDialog.getByRole('button', { name: '0-plus', exact: true }).click();

      // Confirm the selection
      await resourcePickerDialog.getByRole('button', { name: 'Select' }).click();
      await expect(resourcePickerDialog).toBeHidden();

      // The symbol input should reflect the newly selected icon from the unicons folder
      await expect(symbolInput).toHaveValue('0-plus');
    });
  }
);
