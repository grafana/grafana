import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

import { resetInstalled } from './utils';

const pluginId = 'yesoreyeram-infinity-datasource';

// These worker-scoped options require a separate file to isolate them from the catalog roundtrip tests.
test.use({
  openFeature: { flags: { vizActionsAuth: true } },
  featureToggles: { vizActionsAuth: false },
});

test.afterEach(async ({ request }) => {
  await resetInstalled(request, pluginId);
});

test(
  'OpenFeature enables Infinity connections in panel actions',
  { tag: ['@plugins'] },
  async ({ request, page, createDataSource, gotoDashboardPage, selectors }) => {
    test.slow();
    const installed = await request.post(`/api/plugins/${pluginId}/install`, { data: {} });
    expect(installed.ok()).toBeTruthy();
    const datasource = await createDataSource({ type: pluginId, name: `OpenFeature Infinity ${randomUUID()}` });
    try {
      const dashboard = await gotoDashboardPage({});
      const editor = await dashboard.addPanel();
      await editor.setVisualization('Table');
      const category = dashboard.getByGrafanaSelector(
        selectors.components.OptionsGroup.toggle('Data links and actions')
      );
      await expect(category).toBeVisible();
      if ((await category.getAttribute('aria-expanded')) !== 'true') {
        await category.click();
      }
      await page.getByRole('button', { name: 'Add action', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('combobox').first().click();
      await expect(page.getByRole('option', { name: /^Direct from browser/ })).toBeVisible();
      await page.getByRole('option').filter({ hasText: datasource.name }).click();
      await expect(dialog.getByText(datasource.name, { exact: true })).toBeVisible();
    } finally {
      await request.delete(`/api/datasources/uid/${datasource.uid}`);
    }
  }
);
