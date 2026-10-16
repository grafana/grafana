import { test } from '@grafana/plugin-e2e';

import { PLUGINS, assertInstallUninstallRoundtrip, resetInstalled } from './utils';

// Serial so afterEach (which uninstalls all plugins) can't race a peer test.
test.describe.configure({ mode: 'serial' });

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
});
