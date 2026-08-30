import { type Page } from 'playwright-core';

import { test, expect } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: {
      splashScreen: true,
    },
  },
});

const STORAGE_API_URL = '/apis/userstorage.grafana.app/';

async function clearSplashStorage(page: Page) {
  const storageInfo = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bootData = (window as any).grafanaBootData;
    const user = bootData?.user;
    const userUID = user?.uid === '' || !user?.uid ? String(user?.id ?? 'anonymous') : user.uid;
    const resourceName = `grafana-splash-screen:${userUID}`;
    const namespace = bootData?.settings?.namespace || 'default';
    return { namespace, resourceName };
  });

  try {
    await page.request.delete(
      `/apis/userstorage.grafana.app/v0alpha1/namespaces/${storageInfo.namespace}/user-storage/${storageInfo.resourceName}`
    );
  } catch {
    // Ignore 404 — resource may not exist yet
  }

  await page.evaluate(({ resourceName }) => {
    const key = `${resourceName}:dismissedVersion`;
    window.localStorage.removeItem(key);
  }, storageInfo);
}

test.describe(
  'Splash Screen Modal',
  {
    tag: ['@various'],
  },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await clearSplashStorage(page);
    });

    test.afterEach(async ({ page }) => {
      await clearSplashStorage(page);
    });

    test('shows splash screen on first visit and persists dismissal across reload', async ({ page }) => {
      await page.goto('/');

      const modal = page.getByRole('dialog', { name: "What's new in Grafana" });
      await expect(modal).toBeVisible();

      const closeButton = modal.getByRole('button', { name: 'Close' });
      await closeButton.click();

      await expect(modal).toBeHidden();

      await Promise.all([page.waitForResponse((response) => response.url().includes(STORAGE_API_URL)), page.reload()]);

      await expect(modal).toBeHidden();
    });
  }
);
