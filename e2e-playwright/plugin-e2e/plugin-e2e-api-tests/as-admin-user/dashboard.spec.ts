import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

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

    test('getPanelById should return a panel by its id', async ({ gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
      const panel = dashboardPage.getPanelById('4');
      await expect(
        panel.locator,
        formatExpectError('Expected panel with id 4 to be visible on the dashboard')
      ).toBeVisible();
    });

    test('refreshDashboard should refresh the dashboard', async ({ gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
      // refreshDashboard clicks the refresh button - it should not throw
      await dashboardPage.refreshDashboard();
    });
  }
);
