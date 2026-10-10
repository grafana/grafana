import { execFileSync } from 'child_process';

import { type BootData } from '@grafana/data';
import { expect } from '@grafana/plugin-e2e';

import { test } from '../dashboards-suite/utils/dashboard-lazy-feature-flows';

// The backend must also enable this flag; the diagnostics CI workflow configures it.
test.use({ openFeature: { flags: { 'grafana.onDemandDiagnostics': true } } });

test('dashboard diagnostics downloads a bundle containing dashboard JSON', async ({
  page,
  gotoDashboardPage,
  dashboardUid,
}, testInfo) => {
  test.slow();
  await gotoDashboardPage({
    uid: dashboardUid,
    queryParams: new URLSearchParams({ shareView: 'download_diagnostics' }),
  });
  const namespace = await page.evaluate(() => {
    const win = window as typeof window & { grafanaBootData?: BootData };
    return win.grafanaBootData?.settings?.namespace ?? '';
  });
  test.skip(namespace.startsWith('stacks-'), 'On-demand diagnostics requires an on-prem server');
  const button = page.getByRole('button', { name: 'Download diagnostics', exact: true });
  await expect(button).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  const bundle = testInfo.outputPath('dashboard-diagnostics.tar.gz');
  await download.saveAs(bundle);
  const members = execFileSync('tar', ['tzf', bundle], { encoding: 'utf8' }).split('\n');
  const dashboardFile = members.find((member) => member === 'dashboard.json' || member.endsWith('/dashboard.json'));
  expect(dashboardFile).toBeTruthy();
  const dashboardJson = JSON.parse(execFileSync('tar', ['xOzf', bundle, dashboardFile!], { encoding: 'utf8' }));
  expect(dashboardJson.title ?? dashboardJson.spec?.title).toBe('Lazy loading verification');
});
