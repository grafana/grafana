import { expect, test } from '@grafana/plugin-e2e';

const REACT_TABLE_DASHBOARD = { uid: 'U_bZIMRMk' };

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test('add panel in already existing dashboard', async ({ gotoDashboardPage, page }) => {
      const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
      await dashboardPage.addPanel();
      await expect(page.url()).toContain('editPanel');
    });

    test('add panel in new dashboard', async ({ dashboardPage, page }) => {
      const panelEditPage = await dashboardPage.addPanel();
      await expect(panelEditPage.panel.locator).toBeVisible();
      await expect(page.url()).toContain('editPanel');
    });
  }
);
