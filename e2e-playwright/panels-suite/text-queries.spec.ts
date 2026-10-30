import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

const datasource = { type: 'grafana', uid: 'grafana' };
const query = { refId: 'A', datasource, queryType: 'randomWalk', startValue: 42, min: 42, max: 42 };

test.use({ openFeature: { flags: { 'grafana.newTextPanel': true, 'text.newFeatures': true } } });

test.describe('Text query lifecycle', { tag: ['@panels'] }, () => {
  for (const pluginVersion of ['13.2.9', '13.3.0', '13.4.0']) {
    test(`static ${pluginVersion} Text remains query-free after edit, save and reload`, async ({
      request,
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      const uid = randomUUID();
      const response = await request.post('/api/dashboards/db', {
        data: {
          dashboard: {
            uid,
            title: `Text queries ${uid}`,
            schemaVersion: 41,
            panels: [
              {
                id: 1,
                type: 'text',
                title: 'Static text',
                pluginVersion,
                datasource,
                targets: pluginVersion === '13.4.0' ? [] : [query],
                options: { mode: 'markdown', content: 'Static text content' },
                gridPos: { x: 0, y: 0, w: 12, h: 8 },
              },
            ],
          },
        },
      });
      expect(response.ok()).toBeTruthy();
      let requests = 0;
      page.on('request', (request) => {
        if (request.url().includes('/api/ds/query')) {
          requests++;
        }
      });
      try {
        const dashboard = await gotoDashboardPage({ uid });
        await expect(page.getByTestId('TextNGPanel-converted-content')).toBeVisible();
        expect(requests).toBe(0);
        const editor = await dashboard.gotoPanelEditPage('1');
        await expect(page.getByTestId('TextNGEditor')).toBeVisible();
        await editor.setPanelTitle('Edited static text');
        await editor.backToDashboard();
        await dashboard.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton).click();
        await dashboard.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton).click();
        await expect(
          dashboard.getByGrafanaSelector(selectors.components.Drawer.DashboardSaveDrawer.saveButton)
        ).toBeHidden();
        const saved = await request.get(`/api/dashboards/uid/${uid}`);
        expect((await saved.json()).dashboard.panels[0].targets).toEqual([]);
        await page.reload();
        await expect(page.getByTestId('TextNGPanel-converted-content')).toBeVisible();
        expect(requests).toBe(0);
      } finally {
        await request.delete(`/api/dashboards/uid/${uid}`);
      }
    });
  }

  test('preserves data-dependent 13.3 Text queries', async ({ request, gotoDashboardPage, page }) => {
    const uid = randomUUID();
    const response = await request.post('/api/dashboards/db', {
      data: {
        dashboard: {
          uid,
          title: `Text data ${uid}`,
          schemaVersion: 41,
          panels: [
            {
              id: 1,
              type: 'text',
              title: 'Data text',
              pluginVersion: '13.3.0',
              datasource,
              targets: [query],
              options: { mode: 'markdown', content: 'Value: ${__value.raw}' },
              gridPos: { x: 0, y: 0, w: 12, h: 8 },
            },
          ],
        },
      },
    });
    expect(response.ok()).toBeTruthy();
    try {
      await gotoDashboardPage({ uid });
      await expect(
        page.getByTestId('TextNGPanel-converted-content').frameLocator('iframe').locator('body')
      ).toContainText('Value: 42');
    } finally {
      await request.delete(`/api/dashboards/uid/${uid}`);
    }
  });

  test('new Text has no query until one is added explicitly', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboard = await gotoDashboardPage({});
    const editor = await dashboard.addPanel();
    await editor.setVisualization('Text');
    await expect(page.getByTestId('TextNGEditor')).toBeVisible();
    await expect(editor.getByGrafanaSelector(selectors.components.QueryEditorRows.rows)).toHaveCount(0);
    await editor.datasource.set('-- Grafana --');
    await editor.getByGrafanaSelector(selectors.components.QueryTab.addQuery).click();
    await expect(editor.getByGrafanaSelector(selectors.components.QueryEditorRows.rows)).toHaveCount(1);
  });
});
