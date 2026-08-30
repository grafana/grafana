import { test, expect } from '@grafana/plugin-e2e';

import { expectAllPanelsLoaded } from '../utils';

test.use({ openFeature: { flags: { 'plugins.useMTPlugins': true } } });

test.describe('grafana-test-panel', { tag: ['@plugins', '@plugins.useMTPlugins'] }, () => {
  test('all panels load on the dashboard without errors', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: 'n1jR8vnnz' });

    // Every panel renders a "panel content" element — holding the viz, or an "Error loading:"
    // alert if its plugin failed to load.
    const panels = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
    await expect(panels.first()).toBeVisible();
    // This dashboard has a fixed set of 18 panels.
    await expectAllPanelsLoaded(panels, 18);
  });
});
