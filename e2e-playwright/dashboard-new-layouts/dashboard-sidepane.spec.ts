import { type Page } from 'playwright-core';

import { test, expect, type E2ESelectorGroups, type DashboardPage } from '@grafana/plugin-e2e';

import testV2Dashboard from '../dashboards/TestV2Dashboard.json';

import {
  flows,
  groupIntoRow,
  groupIntoTab,
  saveDashboard,
  selectRow,
  stripMetadataNameFromImportJson,
  toggleRow,
} from './utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';
const DASHBOARD_NAME = 'Test variable output';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
});

// these tests require a larger viewport
test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard sidebar pane go back',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Can go back to previous selection or pane', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({});

      await dashboardPage.getByGrafanaSelector(selectors.components.Sidebar.newPanelButton).click();

      await flows.changePanelTitle(dashboardPage, selectors, 'New panel', 'A panel with a title');
    });
  }
);
