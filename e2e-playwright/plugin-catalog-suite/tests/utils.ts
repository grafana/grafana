import { type APIRequestContext, type Page, type Request } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

import { type GcomPlugin, mockGcomApi } from '../../utils/gcom-api-mock';

// App must be a pure app (no bundled panel) — bundled panels appear in the viz picker and break panelIcons.spec.ts.
// The versions are pinned because the backend downloads the real package from grafana.com; bump them if a
// version is ever unpublished.
const CATALOG_PLUGINS: Array<GcomPlugin & { label: string }> = [
  { slug: 'grafana-llm-app', name: 'LLM', type: 'app', version: '1.0.8', grafanaDependency: '>=9.5.2', label: 'app' },
  {
    slug: 'yesoreyeram-infinity-datasource',
    name: 'Infinity',
    type: 'datasource',
    version: '3.11.1',
    grafanaDependency: '>=11.6.0-0',
    label: 'datasource',
  },
  {
    slug: 'grafana-clock-panel',
    name: 'Clock',
    type: 'panel',
    version: '3.2.2',
    grafanaDependency: '>=11.0.0',
    label: 'panel',
  },
];

export const PLUGINS = CATALOG_PLUGINS.map(({ slug, label }) => ({ id: slug, label }));

type Action = 'install' | 'uninstall';

// Legacy REST path (POST /api/plugins/:id/install|uninstall) — always called.
function isLegacy(action: Action, method: string, url: string, pluginId: string): boolean {
  return method === 'POST' && url.includes(`/api/plugins/${pluginId}/${action}`);
}

// K8s PluginMeta path (apis/plugins.grafana.app) — only called when plugins.useMTPlugins is on.
function isMt(action: Action, method: string, url: string, pluginId: string): boolean {
  if (!url.includes('/apis/plugins.grafana.app/')) {
    return false;
  }
  return action === 'install'
    ? method === 'POST' && url.endsWith('/plugins')
    : method === 'DELETE' && url.endsWith(`/plugins/${pluginId}`);
}

// Runs `trigger`, then asserts: legacy always ok, MT ok iff `mt`, MT absent if `!mt` (waiters set pre-click; success reloads).
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

// Install -> uninstall through the catalog UI, asserting the write paths and button flips (uninstall confirms via modal).
export async function assertInstallUninstallRoundtrip(page: Page, pluginId: string, mt: boolean): Promise<void> {
  await mockGcomApi(page, CATALOG_PLUGINS);
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

// afterEach safety net: best-effort uninstall via both paths, ignoring 404s (already uninstalled / no CR).
export async function resetInstalled(request: APIRequestContext, pluginId: string): Promise<void> {
  await request.post(`/api/plugins/${pluginId}/uninstall`).catch(() => undefined);
  await request
    .delete(`/apis/plugins.grafana.app/v0alpha1/namespaces/default/plugins/${pluginId}`)
    .catch(() => undefined);
}
