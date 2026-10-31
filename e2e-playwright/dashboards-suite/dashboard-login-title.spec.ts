import { test, expect } from '@grafana/plugin-e2e';

const suffix = `${Date.now().toString(36)}-${process.pid}`;
const dashboards = [
  { uid: `dashboard-title-a-${suffix}`, title: `API Latency ${suffix}` },
  { uid: `dashboard-title-b-${suffix}`, title: `Mimir / Writes ${suffix}` },
];

test.use({
  httpCredentials: undefined,
  featureToggles: { useSessionStorageForRedirection: true },
  openFeature: { flags: { 'grafana.preserveLoginTabTitle': true, 'grafana.preserveDashboardLoginTabTitle': true } },
});

test.describe('Dashboard names after session expiry', { tag: ['@dashboards'] }, () => {
  // Context routes also apply to tabs created with context.newPage().
  test.beforeEach(async ({ context, openFeature }) => {
    await context.route('**/ofrep/v1/evaluate/flags', async (route) => {
      // Plugins like the assistant serve their own OFREP endpoint, which isn't set up in CI. Only override Grafana's.
      if (new URL(route.request().url()).pathname.startsWith('/api/plugins/')) {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      if (!response.ok()) {
        await route.fulfill({ response });
        return;
      }
      const body = await response.json();
      body.flags = body.flags.filter((flag: { key: string }) => !(flag.key in openFeature.flags));
      body.flags.push(...Object.entries(openFeature.flags).map(([key, value]) => ({ key, value, reason: 'STATIC' })));
      await route.fulfill({ response, json: body });
    });
  });

  test.beforeAll(async ({ request }) => {
    for (const dashboard of dashboards) {
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: { ...dashboard, schemaVersion: 41, panels: [] },
          folderUid: '',
          overwrite: false,
          inputs: [],
        },
      });
      expect(response.ok()).toBe(true);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const dashboard of dashboards) {
      await request.delete(`/api/dashboards/uid/${dashboard.uid}`);
    }
  });

  test('keeps distinct dashboard names through expiry, reload, login, and sign-out', async ({
    page,
    context,
    selectors,
    grafanaAPICredentials,
  }) => {
    const secondTab = await context.newPage();
    const tabs = [page, secondTab];
    for (const [index, tab] of tabs.entries()) {
      await tab.goto(`/d/${dashboards[index].uid}`);
      await expect(tab).toHaveTitle(new RegExp(dashboards[index].title));
      await expect(tab.getByTestId(selectors.components.NavToolbar.markAsFavorite)).toBeVisible();
    }

    // Exercise a chrome refresh after the renderer has captured the dashboard name.
    await page.getByTestId(selectors.components.NavToolbar.markAsFavorite).click();
    await context.clearCookies({ name: 'grafana_session' });
    for (const [index, tab] of tabs.entries()) {
      await tab.reload();
      await expect(tab.getByTestId(selectors.pages.Login.username)).toBeVisible();
      await expect(tab).toHaveTitle(`${dashboards[index].title} - Sign in - Grafana`);
    }
    await page.reload();
    await expect(page).toHaveTitle(`${dashboards[0].title} - Sign in - Grafana`);
    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);
    await page.getByTestId(selectors.pages.Login.submit).click();
    if (grafanaAPICredentials.password === 'admin') {
      await page.getByTestId(selectors.pages.Login.skip).click();
    }
    await expect(page).toHaveTitle(new RegExp(dashboards[0].title));
    await secondTab.reload();
    await expect(secondTab).toHaveTitle(new RegExp(dashboards[1].title));
    await page.getByRole('button', { name: /profile/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
    await expect(page).toHaveTitle('Grafana');
  });

  test('uses the updated name after a dashboard is renamed and reloaded', async ({
    page,
    context,
    request,
    selectors,
  }) => {
    const response = await request.get(`/api/dashboards/uid/${dashboards[0].uid}`);
    expect(response.ok()).toBe(true);
    const { dashboard } = await response.json();
    const title = `Renamed / Dashboard ${suffix}`;
    try {
      await page.goto(`/d/${dashboards[0].uid}`);
      await expect(page).toHaveTitle(new RegExp(dashboards[0].title));
      const save = await request.post('/api/dashboards/db', {
        data: { dashboard: { ...dashboard, title }, overwrite: true },
      });
      expect(save.ok()).toBe(true);
      await page.reload();
      await expect(page).toHaveTitle(new RegExp(title));
      await expect(page.getByTestId(selectors.components.NavToolbar.markAsFavorite)).toBeVisible();
      await context.clearCookies({ name: 'grafana_session' });
      await page.reload();
      await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
      await expect(page).toHaveTitle(`${title} - Sign in - Grafana`);
    } finally {
      const restore = await request.post('/api/dashboards/db', { data: { dashboard, overwrite: true } });
      expect(restore.ok()).toBe(true);
    }
  });

  test('uses the Explore label after navigating away from a named dashboard', async ({ page, context, selectors }) => {
    await page.goto(`/d/${dashboards[0].uid}`);
    await expect(page).toHaveTitle(new RegExp(dashboards[0].title));
    await expect(page.getByTestId(selectors.components.NavToolbar.markAsFavorite)).toBeVisible();
    await page.keyboard.type('ge');
    await expect(page.getByTestId(selectors.pages.Explore.General.container)).toBeVisible();
    await context.clearCookies({ name: 'grafana_session' });
    await page.reload();
    await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
    await expect(page).toHaveTitle('Explore - Sign in - Grafana');
  });
});
