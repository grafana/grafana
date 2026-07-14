import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';

const REACT_TABLE_DASHBOARD = { uid: 'U_bZIMRMk' };

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('dashboard time range', () => {
      test('should set relative time range on existing dashboard', async ({ gotoDashboardPage }) => {
        const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
        await dashboardPage.timeRange.set({ from: 'now-6h', to: 'now' });
        await expect(
          dashboardPage.ctx.page.getByLabel('Time range selected'),
          formatExpectError('Expected time range picker to display the selected relative time range')
        ).toContainText('Last 6 hours');
      });

      test('should set absolute time range on existing dashboard', async ({ gotoDashboardPage }) => {
        const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
        await dashboardPage.timeRange.set({ from: '2025-01-01 00:00:00', to: '2025-01-01 23:59:59' });
        await expect(
          dashboardPage.ctx.page.getByLabel('Time range selected'),
          formatExpectError('Expected time range picker to display the selected absolute time range')
        ).toBeVisible();
      });

      test('should set time range with time zone on existing dashboard', async ({ gotoDashboardPage }) => {
        const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
        await dashboardPage.timeRange.set({ from: 'now-1h', to: 'now', zone: 'Stockholm' });
        await expect(
          dashboardPage.ctx.page.getByLabel('Time range selected'),
          formatExpectError('Expected time range picker to display the selected time range with time zone')
        ).toContainText('Last 1 hour');
      });
    });

    test.describe('panel edit time range', () => {
      test('should set relative time range on panel edit page', async ({ panelEditPage }) => {
        await panelEditPage.timeRange.set({ from: 'now-12h', to: 'now' });
        await expect(
          panelEditPage.ctx.page.getByLabel('Time range selected'),
          formatExpectError('Expected time range picker to display the selected relative time range')
        ).toContainText('Last 12 hours');
      });
    });
  }
);
