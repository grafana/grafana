import { test } from '@grafana/plugin-e2e';

import { PLUGINS, assertInstallUninstallRoundtrip, resetInstalled } from './utils';

// Installs/uninstalls the mock-catalog plugins on disk. The MT variant is a separate file+project
// (openFeature must be file-level) that depends on this one, so the two never mutate install state at
// the same time. Serial within the file so the three plugins don't install concurrently.
test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ request }) => {
  for (const plugin of PLUGINS) {
    await resetInstalled(request, plugin.id);
  }
});

test.describe('mock catalog install/uninstall (legacy path)', { tag: ['@plugins'] }, () => {
  for (const plugin of PLUGINS) {
    test(`installs and uninstalls the ${plugin.label} plugin via /api/plugins/:id/install`, async ({ page }) => {
      await assertInstallUninstallRoundtrip(page, plugin.id, false);
    });
  }
});
