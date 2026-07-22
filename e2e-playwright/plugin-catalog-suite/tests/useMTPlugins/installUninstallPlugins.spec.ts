import { test } from '@grafana/plugin-e2e';

import { PLUGINS, assertInstallUninstallRoundtrip, resetInstalled } from '../utils';

// MT path: with plugins.useMTPlugins on, install/uninstall also hit the K8s PluginMeta apiserver (in
// addition to the always-present legacy REST path). openFeature is file-level (forces a new worker);
// this project depends on the baseline so the two never mutate install state at once. Serial within
// the file so the three plugins don't install concurrently.
test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true } } });

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ request }) => {
  for (const plugin of PLUGINS) {
    await resetInstalled(request, plugin.id);
  }
});

test.describe('mock catalog install/uninstall (MT path)', { tag: ['@plugins', '@plugins.useMTPlugins'] }, () => {
  for (const plugin of PLUGINS) {
    test(`installs and uninstalls the ${plugin.label} plugin via the PluginMeta apiserver`, async ({ page }) => {
      await assertInstallUninstallRoundtrip(page, plugin.id, true);
    });
  }
});
