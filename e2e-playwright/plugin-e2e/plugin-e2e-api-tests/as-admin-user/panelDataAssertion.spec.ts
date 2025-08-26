import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { successfulDataQuery } from '../mocks/queries';

const REACT_TABLE_DASHBOARD = { uid: 'U_bZIMRMk' };

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('panel edit page', () => {
      test('table panel data assertions with provisioned dashboard', async ({ gotoPanelEditPage }) => {
        const panelEditPage = await gotoPanelEditPage({ dashboard: REACT_TABLE_DASHBOARD, id: '4' });
        await expect(
          panelEditPage.panel.locator,
          formatExpectError('Could not locate panel in panel edit page')
        ).toBeVisible();
        await expect(
          panelEditPage.panel.fieldNames,
          formatExpectError('Could not locate header elements in table panel')
        ).toContainText(['Field', 'Max', 'Mean', 'Last']);
      });

      test('table panel data assertions', async ({ panelEditPage }) => {
        await panelEditPage.mockQueryDataResponse(successfulDataQuery, 200);
        await panelEditPage.datasource.set('gdev-testdata');
        await panelEditPage.setVisualization('Table');
        await panelEditPage.refreshPanel();
        await expect(
          panelEditPage.panel.locator,
          formatExpectError('Could not locate panel in panel edit page')
        ).toBeVisible();
        await expect(
          panelEditPage.panel.fieldNames,
          formatExpectError('Could not locate header elements in table panel')
        ).toContainText(['col1', 'col2']);
        await expect(
          panelEditPage.panel.locator.getByRole('gridcell'),
          formatExpectError('Could not locate headers in table panel')
        ).toContainText(['val1', 'val2', 'val3', 'val4']);
      });

      test('timeseries panel - table view assertions', async ({ panelEditPage }) => {
        await panelEditPage.mockQueryDataResponse(successfulDataQuery, 200);
        await panelEditPage.datasource.set('gdev-testdata');
        await panelEditPage.setVisualization('Time series');
        await panelEditPage.refreshPanel();
        await panelEditPage.toggleTableView();
        await expect(
          panelEditPage.panel.locator,
          formatExpectError('Could not locate panel in panel edit page')
        ).toBeVisible();
        await expect(
          panelEditPage.panel.fieldNames,
          formatExpectError('Could not locate header elements in table panel')
        ).toContainText(['col1', 'col2']);
        await expect(
          panelEditPage.panel.locator.getByRole('gridcell'),
          formatExpectError('Could not locate data elements in table panel')
        ).toContainText(['val1', 'val2', 'val3', 'val4']);
      });
    });

    test.describe('dashboard page', () => {
      test('getting panel by title', async ({ gotoDashboardPage }) => {
        const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
        await dashboardPage.goto();
        const panel = await dashboardPage.getPanelByTitle('Colored background');
        await expect(panel.fieldNames).toContainText(['Field', 'Max', 'Mean', 'Last']);
      });

      test('getting panel by id', async ({ gotoDashboardPage }) => {
        const dashboardPage = await gotoDashboardPage(REACT_TABLE_DASHBOARD);
        await dashboardPage.goto();
        const panel = await dashboardPage.getPanelByTitle('Colored background');
        await expect(
          panel.fieldNames,
          formatExpectError('Could not locate header elements in table panel')
        ).toContainText(['Field', 'Max', 'Mean', 'Last']);
      });
    });

    test.describe('explore page', () => {
      test('table panel', async ({ explorePage }) => {
        const url =
          'left=%7B"datasource":"grafana","queries":%5B%7B"queryType":"randomWalk","refId":"A","datasource":%7B"type":"datasource","uid":"grafana"%7D%7D%5D,"range":%7B"from":"1547161200000","to":"1576364400000"%7D%7D&orgId=1';
        await explorePage.goto({
          queryParams: new URLSearchParams(url),
        });
        await expect(
          explorePage.timeSeriesPanel.locator,
          formatExpectError('Could not locate time series panel in explore page')
        ).toBeVisible();
        await expect(
          explorePage.tablePanel.locator,
          formatExpectError('Could not locate table panel in explore page')
        ).toBeVisible();
        await expect(explorePage.tablePanel.fieldNames).toContainText(['time', 'A-series']);
      });
    });
  }
);
