import { selectors } from '@grafana/e2e-selectors';
import { test, expect } from '@grafana/plugin-e2e';

import { testIds } from '../testIds';

// Provisioned from devenv/dev-dashboards by the e2e server
const DASHBOARD_TITLE = 'Panel Tests - Bar Gauge';

test.describe(
  'grafana-extensionstest-app',
  {
    tag: ['@plugins'],
  },
  () => {
    test('should render a plugin component on dashboard rows of the command palette', async ({ page }) => {
      await page.goto('/');

      // Open via the nav toolbar trigger rather than Ctrl/Cmd+K, which Chromium can swallow in CI
      const trigger = page.getByTestId(selectors.components.NavToolbar.commandPaletteTrigger);
      await trigger.getByRole('button').click();
      await page.getByPlaceholder('Search or jump to...').fill(DASHBOARD_TITLE);

      const dashboardResult = page.getByRole('option').filter({ hasText: DASHBOARD_TITLE }).first();
      await expect(dashboardResult.getByTestId(testIds.appB.commandPaletteOwner)).toHaveText('Owner: Hello World');
    });
  }
);
