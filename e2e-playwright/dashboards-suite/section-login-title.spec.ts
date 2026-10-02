import { test, expect } from '@grafana/plugin-e2e';

const suffix = Date.now().toString(36);
const dashboards = [{ uid: `login-title-a-${suffix}`, title: `API Latency ${suffix}` }];

test.use({
  httpCredentials: undefined,
  featureToggles: { useSessionStorageForRedirection: true },
});

test.describe('Section titles after session expiry', { tag: ['@dashboards'] }, () => {
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

  test('uses the latest section after navigating in the same tab', async ({ page, context, selectors }) => {
    await page.goto(`/d/${dashboards[0].uid}`);
    await expect(page).toHaveTitle(new RegExp(dashboards[0].title));
    await expect(page.getByTestId(selectors.components.NavToolbar.markAsFavorite)).toBeVisible();

    // Use Grafana's shortcut to navigate without reloading the application.
    await page.keyboard.type('ge');
    await expect(page.getByTestId(selectors.pages.Explore.General.container)).toBeVisible();
    await expect(page).toHaveURL(/\/explore/);
    await expect(page).toHaveTitle(/Explore/);

    await context.clearCookies({ name: 'grafana_session' });
    await page.reload();
    await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
    await expect(page).toHaveTitle('Explore - Sign in - Grafana');

    await page.reload();
    await expect(page).toHaveTitle('Explore - Sign in - Grafana');
  });

  test('keeps section labels through expiry, reload, and login', async ({
    page,
    context,
    selectors,
    grafanaAPICredentials,
  }) => {
    const secondTab = await context.newPage();
    const tabs = [page, secondTab];
    for (const [index, tab] of tabs.entries()) {
      await tab.goto(index === 0 ? `/d/${dashboards[0].uid}` : '/explore');
      await expect(tab).toHaveTitle(index === 0 ? new RegExp(dashboards[0].title) : /Explore/);
    }

    // Removing the session cookie makes the next request follow the expired-session path.
    await context.clearCookies({ name: 'grafana_session' });
    await page.getByTestId(selectors.components.NavToolbar.markAsFavorite).click();
    await secondTab.reload();
    for (const [index, tab] of tabs.entries()) {
      await expect(tab.getByTestId(selectors.pages.Login.username)).toBeVisible();
      await expect(tab).toHaveTitle(`${index === 0 ? 'Dashboards' : 'Explore'} - Sign in - Grafana`);
    }

    await page.reload();
    await expect(page).toHaveTitle('Dashboards - Sign in - Grafana');
    await page.getByTestId(selectors.pages.Login.username).fill(grafanaAPICredentials.user);
    await page.getByTestId(selectors.pages.Login.password).fill(grafanaAPICredentials.password);
    await page.getByTestId(selectors.pages.Login.submit).click();
    if (grafanaAPICredentials.password === 'admin') {
      await page.getByTestId(selectors.pages.Login.skip).click();
    }
    await expect(page).toHaveURL(new RegExp(`/d/${dashboards[0].uid}/`));
    await expect(page).toHaveTitle(new RegExp(dashboards[0].title));

    await secondTab.reload();
    await expect(secondTab).toHaveURL(/\/explore/);
    await expect(secondTab).toHaveTitle(/Explore/);

    await page.getByRole('button', { name: /profile/i }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect(page.getByTestId(selectors.pages.Login.username)).toBeVisible();
    await expect(page).toHaveTitle('Grafana');
  });
});
