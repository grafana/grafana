import { expect, test } from '@grafana/plugin-e2e';

test.use({
  featureToggles: { dashboardNewLayouts: true },
  openFeature: { flags: { dashboardNewLayouts: true, 'grafana.dashboardSettingsRedesign': true } },
});

for (const mode of ['absent', 'recording', 'replay'] as const) {
  test(`Meticulous integration in ${mode} mode`, async ({ page, gotoDashboardPage }) => {
    const adapterRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script' && request.url().includes('meticulous-openfeature')) {
        adapterRequests.push(request.url());
      }
    });
    await page.addInitScript((mode) => {
      if (mode === 'absent') {
        delete window.Meticulous;
        return;
      }
      window.Meticulous = {
        isRunningAsTest: mode === 'replay',
        context: {
          getFlagOverride(key) {
            sessionStorage.setItem('meticulous-test-queried', 'true');
            return key === 'dashboardNewLayouts' ? { overridden: true, value: false } : { overridden: false };
          },
          recordFeatureFlag(key, value) {
            const flags = JSON.parse(sessionStorage.getItem('meticulous-test-reported') ?? '{}');
            flags[key] = value;
            sessionStorage.setItem('meticulous-test-reported', JSON.stringify(flags));
            return { success: true };
          },
        },
      };
    }, mode);

    await gotoDashboardPage({
      uid: 'kVi2Gex7z',
      queryParams: new URLSearchParams({ editview: 'variables' }),
    });
    if (mode === 'replay') {
      await expect(page.getByRole('button', { name: 'Add variable', exact: true })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('meticulous-test-queried'))).toBe('true');
    } else {
      await expect(page.getByText('Looking for variable settings?', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem('meticulous-test-queried'))).toBeNull();
    }
    if (mode !== 'absent') {
      expect(adapterRequests).toHaveLength(1);
      await expect
        .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('meticulous-test-reported') ?? '{}')))
        .toMatchObject({ dashboardNewLayouts: mode !== 'replay', 'grafana.dashboardSettingsRedesign': true });
    } else {
      expect(adapterRequests).toEqual([]);
      expect(await page.evaluate(() => sessionStorage.getItem('meticulous-test-reported'))).toBeNull();
    }
  });
}
