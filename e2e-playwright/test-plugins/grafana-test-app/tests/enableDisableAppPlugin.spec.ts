import { test } from '@grafana/plugin-e2e';

import pluginJson from '../plugin.json';
import { assertEnableDisableRoundtrip, restoreAppPluginEnabled } from './utils';

// Mutates the shared plugin's enabled state — keep one test per file and stress-test with --workers=1.

// Legacy path (MT flags off). The MT variant is a separate file+project because openFeature must be
// file-level; that project depends on this one so the two never toggle the shared fixture at once.
test.afterEach(async ({ request }) => {
  await restoreAppPluginEnabled(request, pluginJson.id);
});

test.describe('grafana-e2etest-app enable/disable (legacy settings path)', { tag: ['@plugins'] }, () => {
  test('disables and enables via POST /api/plugins/:id/settings', async ({ page }) => {
    await assertEnableDisableRoundtrip(page, pluginJson.id, 'legacy');
  });
});
