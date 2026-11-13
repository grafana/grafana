import { type APIRequestContext, type Page, type Request } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

// App must be a pure app (no bundled panel) — bundled panels appear in the viz picker and break panelIcons.spec.ts.
export const PLUGINS = [
  { id: 'grafana-llm-app', label: 'app' },
  { id: 'yesoreyeram-infinity-datasource', label: 'datasource' },
  { id: 'grafana-clock-panel', label: 'panel' },
];

type Action = 'install' | 'uninstall';

// Legacy REST path (POST /api/plugins/:id/install|uninstall), only called when plugins.useMTPlugins is off.
function isLegacy(action: Action, method: string, url: string, pluginId: string): boolean {
  return method === 'POST' && url.includes(`/api/plugins/${pluginId}/${action}`);
}

// K8s PluginMeta path (apis/plugins.grafana.app), only called when plugins.useMTPlugins is on.
function isMt(action: Action, method: string, url: string, pluginId: string): boolean {
  if (!url.includes('/apis/plugins.grafana.app/')) {
    return false;
  }
  return action === 'install'
    ? method === 'POST' && url.endsWith('/plugins')
    : method === 'DELETE' && url.endsWith(`/plugins/${pluginId}`);
}

// Runs `trigger`, then asserts exactly one write path was used: MT when `mt`, legacy otherwise (waiters set pre-click).
// `settled` runs after the response so a late call on the other path is still recorded before the check.
async function clickAndAssert(
  page: Page,
  action: Action,
  pluginId: string,
  mt: boolean,
  trigger: () => Promise<void>,
  settled: () => Promise<void>
): Promise<void> {
  const unexpectedSeen: string[] = [];
  const record = (req: Request) => {
    const unexpected = mt
      ? isLegacy(action, req.method(), req.url(), pluginId)
      : isMt(action, req.method(), req.url(), pluginId);
    if (unexpected) {
      unexpectedSeen.push(`${req.method()} ${req.url()}`);
    }
  };
  page.on('request', record);

  const expected = mt ? isMt : isLegacy;
  const responsePromise = page.waitForResponse((res) => expected(action, res.request().method(), res.url(), pluginId));

  await trigger();

  const response = await responsePromise;
  expect(
    response.ok(),
    `${action} ${mt ? 'MT' : 'legacy'} ${response.url()} returned ${response.status()}`
  ).toBeTruthy();

  await settled();
  page.off('request', record);

  expect(
    unexpectedSeen,
    `expected no ${mt ? 'legacy' : 'MT'} ${action} call (flag ${mt ? 'on' : 'off'}) but saw: ${unexpectedSeen.join(', ')}`
  ).toHaveLength(0);
}

// Install -> uninstall through the catalog UI, asserting the write paths and button flips (uninstall confirms via modal).
export async function assertInstallUninstallRoundtrip(page: Page, pluginId: string, mt: boolean): Promise<void> {
  await page.goto(`/plugins/${pluginId}`);

  const installButton = page.getByRole('button', { name: 'Install', exact: true });
  const uninstallButton = page.getByRole('button', { name: 'Uninstall', exact: true });
  const confirmButton = page.getByRole('button', { name: 'Confirm', exact: true });

  await expect(installButton).toBeVisible();
  await clickAndAssert(
    page,
    'install',
    pluginId,
    mt,
    async () => {
      await installButton.click();
    },
    () => expect(uninstallButton).toBeVisible()
  );

  await clickAndAssert(
    page,
    'uninstall',
    pluginId,
    mt,
    async () => {
      await uninstallButton.click();
      await confirmButton.click();
    },
    () => expect(installButton).toBeVisible()
  );
}

// afterEach safety net: best-effort uninstall via both paths, ignoring 404s (already uninstalled / no CR).
export async function resetInstalled(request: APIRequestContext, pluginId: string): Promise<void> {
  await request.post(`/api/plugins/${pluginId}/uninstall`).catch(() => undefined);
  await request
    .delete(`/apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/${pluginId}`)
    .catch(() => undefined);
}
