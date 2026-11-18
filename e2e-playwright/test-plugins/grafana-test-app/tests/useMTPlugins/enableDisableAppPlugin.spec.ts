import { expect, test } from '@grafana/plugin-e2e';

import pluginJson from '../../plugin.json';

// MT path: both flags on (useMTPluginSettings needs useMTPlugins too). openFeature is file-level
// (forces a new worker); this project depends on the baseline so they never toggle the fixture at once.
test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true, 'plugins.useMTPluginSettings': true } } });

test.describe(
  'grafana-e2etest-app enable/disable (MT settings path)',
  { tag: ['@plugins', '@plugins.useMTPlugins'] },
  () => {
    // App settings only exist for enabled apps, so the MT path has nothing to disable.
    test('shows the provisioned app as enabled without a Disable action', async ({ page }) => {
      await page.goto(`/plugins/${pluginJson.id}`);
      await expect(page.getByRole('heading', { name: pluginJson.name })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Enable', exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Disable', exact: true })).toBeHidden();
    });
  }
);
