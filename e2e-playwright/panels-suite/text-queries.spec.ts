import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

const datasource = { type: 'grafana', uid: 'grafana' };
const query = { refId: 'A', datasource, queryType: 'randomWalk', startValue: 42, min: 42, max: 42 };

test.use({ openFeature: { flags: { 'grafana.newTextPanel': true, 'text.newFeatures': true, queryEditorNext: true } } });

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
                targets: pluginVersion === '13.4.0' ? [] : [{ refId: 'A' }],
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

  for (const queryEditorNext of [false, true]) {
    test.describe(`new Text with queryEditorNext=${queryEditorNext}`, () => {
      test('reloads the inline editor with data after adding the first query', async ({
        gotoDashboardPage,
        page,
        selectors,
      }) => {
        await page.addInitScript((useNext) => {
          localStorage.setItem(
            'grafana.dashboard.query-editor-next.v2-preference',
            JSON.stringify({ value: useNext, timestamp: Date.now() })
          );
        }, queryEditorNext);
        const dashboard = await gotoDashboardPage({});
        const editor = await dashboard.addPanel();
        await editor.setVisualization('Time series');
        const queries = queryEditorNext
          ? page.locator('[data-query-sidebar-card="A"]')
          : editor.getByGrafanaSelector(selectors.components.QueryEditorRows.rows);
        await expect(queries).toHaveCount(1);
        await editor.setVisualization('Text');
        const textEditor = page.getByTestId('TextNGEditor');
        await expect(textEditor).toBeVisible();
        await expect(queries).toHaveCount(0);
        await textEditor.locator('.cm-content').fill('Value: ${__value.raw}');

        const addQuery = queryEditorNext
          ? page.getByLabel('Add query', { exact: true })
          : editor.getByGrafanaSelector(selectors.components.QueryTab.addQuery);
        await addQuery.click();

        await expect(queries).toHaveCount(1);
        await expect(textEditor).toBeVisible();
        await expect(
          page.getByTestId('TextNGEditor-preview').frameLocator('iframe[title="Text panel content"]').locator('body')
        ).toContainText(/Value: -?\d+(?:\.\d+)?/);
      });
    });
  }
});
