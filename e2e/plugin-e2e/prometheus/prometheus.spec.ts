import { expect, test } from '@grafana/plugin-e2e';

import { enterCodeEditorQueryExpr, setEditorMode } from './utils';

test('Smoke test: decoupled plugin loads', async ({ createDataSourceConfigPage, page }) => {
  await createDataSourceConfigPage({ type: 'prometheus' });
  await expect(await page.getByText('Type: Prometheus', { exact: true })).toBeVisible();
  await expect(await page.getByRole('heading', { name: 'Connection', exact: true })).toBeVisible();
});

test('query data response should be OK when query is valid', async ({ panelEditPage, selectors }) => {
  await panelEditPage.datasource.set('gdev-prometheus');
  await panelEditPage.setVisualization('Table');
  await setEditorMode(panelEditPage, selectors, 'code');
  await enterCodeEditorQueryExpr(panelEditPage, selectors, 'up');
  await expect(panelEditPage.refreshPanel()).toBeOK();
  await expect(panelEditPage.panel.data).toContainText(['1']);
});
