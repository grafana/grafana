import { randomUUID } from 'node:crypto';

import { test, expect } from '@grafana/plugin-e2e';

import { PLUGINS, assertInstallUninstallRoundtrip, resetInstalled } from './utils';

// Serial so afterEach (which uninstalls all plugins) can't race a peer test.
test.describe.configure({ mode: 'serial' });

test.use({
  openFeature: { flags: { vizActionsAuth: true } },
  featureToggles: { vizActionsAuth: false },
});

test.afterEach(async ({ request }) => {
  for (const plugin of PLUGINS) {
    await resetInstalled(request, plugin.id);
  }
});

test.describe('catalog install/uninstall (legacy path)', { tag: ['@plugins'] }, () => {
  for (const plugin of PLUGINS) {
    test(`installs and uninstalls the ${plugin.label} plugin via /api/plugins/:id/install`, async ({ page }) => {
      await assertInstallUninstallRoundtrip(page, plugin.id, false);
    });
  }

  // Keep this in the serial installation suite so plugin cleanup cannot race the action editor.
  test('OpenFeature enables Infinity connections in panel actions', async ({
    request,
    page,
    createDataSource,
    gotoDashboardPage,
    selectors,
  }) => {
    test.slow();
    const pluginId = 'yesoreyeram-infinity-datasource';
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
  });
});
