import { test, expect } from '@grafana/plugin-e2e';
import { testIds } from '../testIds';
import pluginJson from '../plugin.json';
import { ensureExtensionRegistryIsPopulated } from './utils';

test.describe(
  'grafana-extensionstest-app',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should display component exposed by another app', async ({ page }) => {
      await page.goto(`/a/${pluginJson.id}/exposed-components`);
      await expect(page.getByTestId(testIds.appB.exposedComponent)).toHaveText('Hello World!');
    });

    test('exposed add-to-dashboard form saves to a new dashboard', async ({ page }) => {
      await page.goto(`/a/${pluginJson.id}/exposed-components`);
      await ensureExtensionRegistryIsPopulated(page);

      // Wait for the exposed form section to be ready
      await expect(page.getByRole('heading', { name: 'Save to dashboard (exposed form)' })).toBeVisible();

      // Wait for any of the form buttons to render (lazy load) before clicking
      const openInNewTab = page.getByRole('button', { name: 'Open in new tab' });
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      await Promise.race([expect(openInNewTab).toBeVisible(), expect(cancelBtn).toBeVisible()]);

      // Now wait for the submit button to be visible, then click (role or text)
      const openDashboardByRole = page.getByRole('button', { name: 'Open dashboard' });
      const openDashboardByText = page.getByText('Open dashboard');
      if (await openDashboardByRole.isVisible().catch(() => false)) {
        await openDashboardByRole.click();
      } else {
        await expect(openDashboardByText.first()).toBeVisible();
        await openDashboardByText.first().click();
      }

      // Navigates to /dashboard/new and prepopulates a panel from local storage
      await expect(page).toHaveURL(/\/dashboard\/new/);

      // Panel should be created with our custom title
      await expect(page.getByText('E2E Add to Dashboard Panel').first()).toBeVisible();
    });
  }
);
