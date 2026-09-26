import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

test.use({ openFeature: { flags: { tableSharedCrosshair: true, tableRefresh: true } } });

test('moves the shared crosshair when hovering table rows and clears it on leave', async ({
  request,
  createDataSource,
  gotoDashboardPage,
  page,
  selectors,
}) => {
  const uid = randomUUID();
  const datasource = await createDataSource({ type: 'grafana-testdata-datasource', name: `Shared crosshair ${uid}` });
  try {
    const response = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          uid,
          title: `Shared crosshair ${uid}`,
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
    await expect(cursor).not.toHaveAttribute('style', before!);
    const middleRowCursor = await cursor.getAttribute('style');
    await table.getByRole('gridcell', { name: '30', exact: true }).hover();
    await expect(cursor).not.toHaveAttribute('style', middleRowCursor!);
    await page.getByRole('navigation', { name: 'Breadcrumbs' }).hover();
    await expect(cursor).toHaveAttribute('style', before!);
  } finally {
    await request.delete(`/api/dashboards/uid/${uid}`);
    await request.delete(`/api/datasources/uid/${datasource.uid}`);
  }
});
