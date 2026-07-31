import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdtempSync } from 'fs';
import { createServer, type Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { type Page } from 'playwright-core';

import { type BootData } from '@grafana/data';
import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

// On-demand diagnostics is on-prem only: the frontend menu item is gated on isOnPrem() (namespace
// must not start with "stacks-") and the backend registers /api/ds/diagnostics only when stack_id is
// empty. The shared e2e-playwright server runs in cloud mode (stack_id = 12345, required by other
// suites), so this spec self-skips there and is meant to run against an on-prem GRAFANA_URL instead.
async function skipUnlessOnPrem(page: Page) {
  const namespace = await page.evaluate(() => {
    const win = window as typeof window & { grafanaBootData?: BootData };
    return win.grafanaBootData?.settings?.namespace ?? '';
  });
  test.skip(namespace.startsWith('stacks-'), 'on-demand diagnostics is on-prem only; e2e server runs in cloud mode');
}

test.use({
  openFeature: {
    flags: {
      'grafana.onDemandDiagnostics': true,
    },
  },
});

const SUCCESS_PANEL = 'Prometheus query (success)';
const FAILURE_PANEL = 'Prometheus query (failure)';
const DOWNLOAD_DIAGNOSTICS = 'Download diagnostics';
const UPSTREAM_FAILURE_BODY = 'simulated upstream failure: connection reset by peer';

/**
 * Starts a bare-bones stand-in for a real Prometheus server: it doesn't validate the incoming
 * PromQL, it just answers every request with the same canned outcome. The Prometheus datasource
 * still makes a genuine HTTP round trip to it over loopback, so the backend query path, its error
 * handling, and the diagnostics HAR capture are all exercised for real.
 */
function startUpstream(behavior: 'success' | 'failure'): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (behavior === 'failure') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(UPSTREAM_FAILURE_BODY);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'success',
          data: {
            resultType: 'matrix',
            result: [
              {
                metric: { __name__: 'up', job: 'e2e-diagnostics' },
                values: [
                  [1700000000, '1'],
                  [1700000060, '1'],
                ],
              },
            ],
          },
        })
      );
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function buildDashboardRequestBody(title: string, successDsUid: string, failureDsUid: string) {
  return {
    dashboard: {
      annotations: { list: [] },
      editable: true,
      panels: [
        {
          datasource: { type: 'prometheus', uid: successDsUid },
          gridPos: { h: 8, w: 12, x: 0, y: 0 },
          id: 1,
          targets: [{ datasource: { type: 'prometheus', uid: successDsUid }, refId: 'A', expr: 'up' }],
          title: SUCCESS_PANEL,
          type: 'timeseries',
        },
        {
          datasource: { type: 'prometheus', uid: failureDsUid },
          gridPos: { h: 8, w: 12, x: 12, y: 0 },
          id: 2,
          targets: [{ datasource: { type: 'prometheus', uid: failureDsUid }, refId: 'A', expr: 'up' }],
          title: FAILURE_PANEL,
          type: 'timeseries',
        },
      ],
      schemaVersion: 39,
      tags: [],
      templating: { list: [] },
      time: { from: 'now-6h', to: 'now' },
      title: title,
      uid: '',
      version: 0,
    },
    folderUid: '',
    overwrite: true,
  };
}

/** Opens a panel's menu and walks the submenu path (e.g. ['More...', 'Download diagnostics']). */
async function selectPanelMenuItem(
  dashboardPage: DashboardPage,
  selectors: E2ESelectorGroups,
  panelTitle: string,
  menuPath: string[]
) {
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle)).hover();
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(panelTitle)).click({ force: true });
  for (const item of menuPath.slice(0, -1)) {
    await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems(item)).hover();
  }
  await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems(menuPath.at(-1)!)).click();
}

/** Clicks the drawer's "Download diagnostics" button and returns the downloaded bundle's member list. */
async function downloadAndListBundle(page: Page) {
  const downloadButton = page.getByRole('button', { name: DOWNLOAD_DIAGNOSTICS });
  await expect(downloadButton).toBeVisible();

  // The bundle is generated server-side from a real backend query, so allow more than the default
  // action timeout.
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await downloadButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.tar\.gz$/);

  const bundle = join(mkdtempSync(join(tmpdir(), 'diag-e2e-')), 'bundle.tar.gz');
  await download.saveAs(bundle);
  const members = execFileSync('tar', ['tzf', bundle], { encoding: 'utf8' }).split('\n').filter(Boolean);
  return { bundle, members };
}

function readBundleMember(bundle: string, member: string) {
  return execFileSync('tar', ['xOzf', bundle, member], { encoding: 'utf8' });
}

test.describe('diagnostics: Download diagnostics drawer', { tag: ['@diagnostics'] }, () => {
  // Both tests share the fixtures set up in beforeAll (datasources, dashboard); run them in one
  // worker so a parallel worker can't race the same beforeAll and collide on datasource names.
  test.describe.configure({ mode: 'serial' });

  let successUpstream: { server: Server; url: string };
  let failureUpstream: { server: Server; url: string };
  let successDsUid: string;
  let failureDsUid: string;
  let dashboardUid: string;

  test.beforeAll(async ({ createDataSource, request }) => {
    successUpstream = await startUpstream('success');
    failureUpstream = await startUpstream('failure');

    // Unique per run: repeated/sharded runs (e.g. `yarn e2e:playwright:10x`) can execute this file
    // more than once concurrently, and a fixed name would race across those runs.
    const runId = randomUUID();

    const successDs = await createDataSource({
      type: 'prometheus',
      name: `e2e-diagnostics-prometheus-success-${runId}`,
      url: successUpstream.url,
      access: 'proxy',
    });
    successDsUid = successDs.uid;

    const failureDs = await createDataSource({
      type: 'prometheus',
      name: `e2e-diagnostics-prometheus-failure-${runId}`,
      url: failureUpstream.url,
      access: 'proxy',
    });
    failureDsUid = failureDs.uid;

    const response = await request.post('/api/dashboards/db', {
      data: buildDashboardRequestBody('Diagnostics download e2e', successDsUid, failureDsUid),
    });
    const body = await response.json();
    dashboardUid = body.uid;
  });

  test.afterAll(async ({ request }) => {
    if (dashboardUid) {
      await request.delete(`/api/dashboards/uid/${dashboardUid}`);
    }
    if (successDsUid) {
      await request.delete(`/api/datasources/uid/${successDsUid}`);
    }
    if (failureDsUid) {
      await request.delete(`/api/datasources/uid/${failureDsUid}`);
    }
    successUpstream?.server.close();
    failureUpstream?.server.close();
  });

  test('successful query — the bundle carries the real upstream traffic, no error', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUid });
    await skipUnlessOnPrem(page);

    await selectPanelMenuItem(dashboardPage, selectors, SUCCESS_PANEL, ['More...', DOWNLOAD_DIAGNOSTICS]);
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.title(DOWNLOAD_DIAGNOSTICS))
    ).toBeVisible();

    const { bundle, members } = await downloadAndListBundle(page);

    const har = members.find((m) => m === 'traffic.har' || m.endsWith('/traffic.har'));
    const queryError = members.find((m) => m === 'query-error.txt' || m.endsWith('/query-error.txt'));
    expect(har, `bundle should contain the captured upstream exchange (members: ${members.join(', ')})`).toBeTruthy();
    expect(queryError, 'a successful query should not produce a query-error.txt').toBeFalsy();

    const harText = readBundleMember(bundle, har!);
    expect(harText, 'traffic.har should show the real 200 response from the upstream').toMatch(/"status":200/);
    expect(harText, 'traffic.har should carry the real upstream URL').toContain(successUpstream.url);
  });

  test('upstream 500 — the bundle localizes the real error', async ({ page, gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: dashboardUid });
    await skipUnlessOnPrem(page);

    await selectPanelMenuItem(dashboardPage, selectors, FAILURE_PANEL, ['More...', DOWNLOAD_DIAGNOSTICS]);
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Drawer.General.title(DOWNLOAD_DIAGNOSTICS))
    ).toBeVisible();

    const { bundle, members } = await downloadAndListBundle(page);

    const har = members.find((m) => m === 'traffic.har' || m.endsWith('/traffic.har'));
    const queryError = members.find((m) => m === 'query-error.txt' || m.endsWith('/query-error.txt'));
    expect(har, `bundle should contain the captured upstream exchange (members: ${members.join(', ')})`).toBeTruthy();
    expect(queryError, `bundle should contain the verbatim query error (members: ${members.join(', ')})`).toBeTruthy();

    const harText = readBundleMember(bundle, har!);
    expect(harText, 'traffic.har should show the real upstream 500 + body').toMatch(/"status":500/);
    expect(harText).toContain(UPSTREAM_FAILURE_BODY);

    const queryErrorText = readBundleMember(bundle, queryError!);
    expect(queryErrorText, 'query-error.txt should quote the upstream failure verbatim').toContain(
      UPSTREAM_FAILURE_BODY
    );
  });
});
