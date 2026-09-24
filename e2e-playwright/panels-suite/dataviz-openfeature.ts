import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

export function datavizOpenFeatureTests(enabled: boolean) {
  test.use({
    openFeature: {
      flags: {
        canvasPanelPanZoom: enabled,
        canvasPanelNesting: enabled,
        tableSharedCrosshair: enabled,
        tableRefresh: true,
        enableColorblindSafePanelOptions: enabled,
        pieChartGradientColorScheme: enabled,
      },
    },
    // Opposing values ensure these controls use OpenFeature, not legacy boot data.
    featureToggles: {
      canvasPanelPanZoom: !enabled,
      canvasPanelNesting: !enabled,
      tableSharedCrosshair: !enabled,
      enableColorblindSafePanelOptions: !enabled,
      pieChartGradientColorScheme: !enabled,
    },
  });

  test('gates Canvas pan and zoom', async ({ gotoDashboardPage, page }) => {
    const dashboard = await gotoDashboardPage({});
    const editor = await dashboard.addPanel();
    await editor.setVisualization('Canvas');
    await expect(page.getByRole('button', { name: 'Double click to set field' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Pan and zoom' })).toHaveCount(enabled ? 1 : 0);
    await expect(page.getByTestId('canvas-scene-pan-zoom')).toHaveCount(enabled ? 1 : 0);
  });

  test('gates the Frame selection control for multiple Canvas elements', async ({ gotoDashboardPage, page }) => {
    const dashboard = await gotoDashboardPage({});
    const editor = await dashboard.addPanel();
    await editor.setVisualization('Canvas');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    const elements = page.getByRole('button', { name: 'Double click to set field' });
    await expect(elements).toHaveCount(2);
    const duplicate = await elements.last().boundingBox();
    expect(duplicate).not.toBeNull();
    await page.mouse.move(duplicate!.x + duplicate!.width / 2, duplicate!.y + duplicate!.height / 2);
    await page.mouse.down();
    await page.mouse.move(duplicate!.x + duplicate!.width / 2, duplicate!.y + duplicate!.height * 3, { steps: 10 });
    await page.mouse.up();
    await elements.first().click();
    await elements.last().click({ modifiers: ['Shift'] });
    await expect(page.getByRole('button', { name: 'Clear selection', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Frame selection', exact: true })).toHaveCount(enabled ? 1 : 0);
  });

  test('gates accessible line styles and color palettes', async ({ gotoDashboardPage, page }) => {
    const dashboard = await gotoDashboardPage({});
    const editor = await dashboard.addPanel();
    await editor.setVisualization('Time series');
    await expect(page.getByRole('radio', { name: 'Solid', exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Accessible', exact: true })).toHaveCount(enabled ? 1 : 0);
    if (enabled) {
      await page.getByRole('radio', { name: 'Accessible', exact: true }).check();
      await expect(page.getByRole('radio', { name: 'Accessible', exact: true })).toBeChecked();
    }
    await page.getByRole('combobox', { name: 'Color scheme', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Classic palette', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Color blind safe', exact: true })).toHaveCount(enabled ? 1 : 0);
    if (enabled) {
      await page.getByRole('option', { name: 'Color blind safe', exact: true }).click();
      await expect(page.getByText('Color blind safe', { exact: true })).toBeVisible();
    }
  });

  test('gates pie chart gradient selection', async ({ gotoDashboardPage, page }) => {
    const dashboard = await gotoDashboardPage({});
    const editor = await dashboard.addPanel();
    await editor.setVisualization('Pie chart');
    await page.getByRole('combobox', { name: 'Color scheme', exact: true }).click();
    await expect(page.getByRole('option', { name: 'Classic palette', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Gradient Interpolate/ })).toHaveCount(enabled ? 1 : 0);
    if (enabled) {
      await page.getByRole('option', { name: /^Gradient Interpolate/ }).click();
      await expect(page.getByText('Gradient', { exact: true })).toBeVisible();
    }
  });

  test('gates shared crosshair from table rows to time series', async ({
    request,
    createDataSource,
    gotoDashboardPage,
    page,
    selectors,
  }) => {
    const uid = randomUUID();
    const datasource = await createDataSource({ type: 'grafana-testdata-datasource', name: `OpenFeature ${uid}` });
    try {
      const response = await request.post('/api/dashboards/db', {
        data: {
          dashboard: {
            uid,
            title: `OpenFeature crosshair ${uid}`,
            schemaVersion: 41,
            graphTooltip: 1,
            time: { from: '2024-01-01T00:00:00Z', to: '2024-01-01T00:02:00Z' },
            panels: ['table', 'timeseries'].map((type, index) => ({
              id: index + 1,
              type,
              title: type,
              gridPos: { x: index * 12, y: 0, w: 12, h: 10 },
              datasource: { uid: datasource.uid, type: datasource.type },
              targets: [
                {
                  refId: 'A',
                  scenarioId: 'csv_content',
                  csvContent: 'time,value\n2024-01-01T00:00:00Z,10\n2024-01-01T00:01:00Z,20\n2024-01-01T00:02:00Z,30',
                },
              ],
              fieldConfig: { defaults: {}, overrides: [] },
              options: {},
            })),
          },
        },
      });
      expect(response.ok()).toBeTruthy();
      const dashboard = await gotoDashboardPage({ uid });
      const table = dashboard
        .getByGrafanaSelector(selectors.components.Panels.Panel.content)
        .filter({ has: page.getByRole('grid') });
      const chart = dashboard
        .getByGrafanaSelector(selectors.components.Panels.Panel.content)
        .filter({ has: page.locator('.uplot') });
      await expect(table.getByRole('gridcell', { name: '20', exact: true })).toBeVisible();
      await expect(chart.locator('.u-over')).toBeVisible();
      const cursor = chart.locator('.u-cursor-x');
      const before = await cursor.getAttribute('style');
      await table.getByRole('gridcell', { name: '20', exact: true }).hover();
      if (enabled) {
        await expect(cursor).not.toHaveAttribute('style', before!);
        await page.getByRole('navigation', { name: 'Breadcrumbs' }).hover();
        await expect(cursor).toHaveAttribute('style', before!);
      } else {
        await expect(cursor).toHaveAttribute('style', before!);
      }
    } finally {
      await request.delete(`/api/dashboards/uid/${uid}`);
      await request.delete(`/api/datasources/uid/${datasource.uid}`);
    }
  });
}
