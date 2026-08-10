import { test } from '@grafana/plugin-e2e';

import { PLUGINS, assertInstallUninstallRoundtrip, resetInstalled } from '../utils';

// MT path: useMTPlugins on -> install/uninstall also hit the PluginMeta apiserver. openFeature is file-level.
test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true } } });

// Serial so afterEach (which uninstalls all plugins) can't race a peer test.
test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ request }) => {
  for (const plugin of PLUGINS) {
    await resetInstalled(request, plugin.id);
  }
});

test.describe('catalog install/uninstall (MT path)', { tag: ['@plugins', '@plugins.useMTPlugins'] }, () => {
  for (const plugin of PLUGINS) {
    test(`installs and uninstalls the ${plugin.label} plugin via the PluginMeta apiserver`, async ({ page }) => {
      await assertInstallUninstallRoundtrip(page, plugin.id, true);
    });
  }
});
