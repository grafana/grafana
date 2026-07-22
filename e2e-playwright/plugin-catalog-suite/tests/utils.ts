import { type APIRequestContext, type Page, type Request } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

// The three plugins served by the mock catalog
// (packages/grafana-test-utils/src/mock-plugin-catalog). Hardcoded to the mock's fixed set.
export const PLUGINS = [
  { id: 'grafana-poc-app', label: 'app' },
  { id: 'grafana-pocds-datasource', label: 'datasource' },
  { id: 'grafana-poc-panel', label: 'panel' },
];

type Action = 'install' | 'uninstall';

// Legacy REST path: POST /api/plugins/:id/install|uninstall — always called by installPlugin/uninstallPlugin.
function isLegacy(action: Action, method: string, url: string, pluginId: string): boolean {
  return method === 'POST' && url.includes(`/api/plugins/${pluginId}/${action}`);
}

// K8s PluginMeta path — only called when plugins.useMTPlugins is on:
//   install   -> POST   apis/plugins.grafana.app/<v>/namespaces/<ns>/plugins
//   uninstall -> DELETE apis/plugins.grafana.app/<v>/namespaces/<ns>/plugins/:id
function isMt(action: Action, method: string, url: string, pluginId: string): boolean {
  if (!url.includes('/apis/plugins.grafana.app/')) {
    return false;
  }
  return action === 'install'
    ? method === 'POST' && url.endsWith('/plugins')
    : method === 'DELETE' && url.endsWith(`/plugins/${pluginId}`);
}

// Runs `trigger` (the click(s) that fire the request) and asserts the write paths. install/uninstall
// always call the legacy path and additionally the MT path when the flag is on, so: assert legacy ok;
// if `mt` assert the MT call ok too; if `!mt` assert the MT call never fired. Response waiters are
// registered before the trigger because success reloads/rerenders the page.
async function clickAndAssert(
  page: Page,
  action: Action,
  pluginId: string,
  mt: boolean,
  trigger: () => Promise<void>
): Promise<void> {
  const mtSeen: string[] = [];
  const record = (req: Request) => {
    if (isMt(action, req.method(), req.url(), pluginId)) {
      mtSeen.push(`${req.method()} ${req.url()}`);
    }
  };
  page.on('request', record);

  const legacyPromise = page.waitForResponse((res) => isLegacy(action, res.request().method(), res.url(), pluginId));
  const mtPromise = mt
    ? page.waitForResponse((res) => isMt(action, res.request().method(), res.url(), pluginId))
    : undefined;

  await trigger();

  const legacy = await legacyPromise;
  expect(legacy.ok(), `${action} legacy ${legacy.url()} returned ${legacy.status()}`).toBeTruthy();

  if (mtPromise) {
    const mtRes = await mtPromise;
    expect(mtRes.ok(), `${action} MT ${mtRes.url()} returned ${mtRes.status()}`).toBeTruthy();
  }

  page.off('request', record);

  if (!mt) {
    expect(mtSeen, `expected no MT ${action} call (flag off) but saw: ${mtSeen.join(', ')}`).toHaveLength(0);
  }
}

// Drives install -> uninstall through the catalog UI, asserting each write routes through the
// expected path(s) and the button flips. Uninstall goes through a confirm modal (InstallControlsButton).
export async function assertInstallUninstallRoundtrip(page: Page, pluginId: string, mt: boolean): Promise<void> {
  await page.goto(`/plugins/${pluginId}`);

  const installButton = page.getByRole('button', { name: 'Install', exact: true });
  const uninstallButton = page.getByRole('button', { name: 'Uninstall', exact: true });
  const confirmButton = page.getByRole('button', { name: 'Confirm', exact: true });

  await expect(installButton).toBeVisible();
  await clickAndAssert(page, 'install', pluginId, mt, async () => {
    await installButton.click();
  });
  await expect(uninstallButton).toBeVisible();

  await clickAndAssert(page, 'uninstall', pluginId, mt, async () => {
    await uninstallButton.click();
    await confirmButton.click();
  });
  await expect(installButton).toBeVisible();
}

// afterEach safety net: return the plugin to the not-installed baseline however a test failed.
// Best-effort — a 404 (already uninstalled) or a no-op MT delete (no CR) is fine to ignore.
export async function resetInstalled(request: APIRequestContext, pluginId: string): Promise<void> {
  await request.post(`/api/plugins/${pluginId}/uninstall`).catch(() => undefined);
  await request
    .delete(`/apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/${pluginId}`)
    .catch(() => undefined);
}
