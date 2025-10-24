import { test, expect } from '@grafana/plugin-e2e';
import { testIds } from '../testIds';
import pluginJson from '../plugin.json';

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

      // Click "Open dashboard" to navigate in the same tab
      await page.getByRole('button', { name: 'Open dashboard' }).click();

      // Navigates to /dashboard/new and prepopulates a panel from local storage
      await expect(page).toHaveURL(/\/dashboard\/new/);

      // Panel should be created with our custom title
      await expect(page.getByText('E2E Add to Dashboard Panel').first()).toBeVisible();
    });
  }
);
