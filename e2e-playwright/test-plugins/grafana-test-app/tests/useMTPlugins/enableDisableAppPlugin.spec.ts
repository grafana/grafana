import { test } from '@grafana/plugin-e2e';

import pluginJson from '../../plugin.json';
import { assertEnableDisableRoundtrip, restoreAppPluginEnabled } from '../utils';

// Mutates the shared plugin's enabled state — keep one test per file and stress-test with --workers=1.

// MT path: both flags on (useMTPluginSettings needs useMTPlugins too). openFeature is file-level
// (forces a new worker); this project depends on the baseline so they never toggle the fixture at once.
test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true, 'plugins.useMTPluginSettings': true } } });

test.afterEach(async ({ request }) => {
  await restoreAppPluginEnabled(request, pluginJson.id);
});

test.describe(
  'grafana-e2etest-app enable/disable (MT settings path)',
  { tag: ['@plugins', '@plugins.useMTPlugins'] },
  () => {
    test('disables and enables via PATCH /apis/:id/.../app/instance', async ({ page }) => {
      await assertEnableDisableRoundtrip(page, pluginJson.id, 'mt');
    });
  }
);
