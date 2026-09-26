import { expect, test } from '@grafana/plugin-e2e';

test.use({
  featureToggles: { dashboardNewLayouts: true },
  openFeature: { flags: { dashboardNewLayouts: true, 'grafana.dashboardSettingsRedesign': true } },
});

for (const enabled of [true, false]) {
  test(`Meticulous adapter loading follows recorder presence: ${enabled}`, async ({ page, gotoDashboardPage }) => {
    const adapterRequests: string[] = [];
    page.on('request', (request) => {
      if (request.resourceType() === 'script' && request.url().includes('meticulous-openfeature')) {
        adapterRequests.push(request.url());
      }
    });
    await page.addInitScript((enabled) => {
      if (!enabled) {
        delete window.Meticulous;
        return;
      }
      window.Meticulous = {
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
    }, enabled);

    await gotoDashboardPage({
      uid: 'kVi2Gex7z',
      queryParams: new URLSearchParams({ editview: 'variables' }),
    });
    if (enabled) {
      await expect(page.getByRole('button', { name: 'Add variable', exact: true })).toBeVisible();
      expect(adapterRequests).toHaveLength(1);
      await expect
        .poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('meticulous-test-reported') ?? '{}')))
        .toMatchObject({ dashboardNewLayouts: false, 'grafana.dashboardSettingsRedesign': true });
    } else {
      await expect(page.getByText('Looking for variable settings?', { exact: true })).toBeVisible();
      expect(adapterRequests).toEqual([]);
      expect(await page.evaluate(() => sessionStorage.getItem('meticulous-test-queried'))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem('meticulous-test-reported'))).toBeNull();
    }
  });
}
