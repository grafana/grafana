import { test, expect } from '@grafana/plugin-e2e';

import { Controls } from './page-objects';
import { getPanelPosition, movePanel } from './utils';

const PAGE_UNDER_TEST = 'ed155665/annotation-filtering';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
    dashboardUndoRedo: true,
    groupByVariable: true,
  },
  // these tests require a larger viewport
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can drag and drop panels', async ({ gotoDashboardPage, selectors, page, components }) => {
      const dashboardPage = await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });

      const controls = new Controls({ page, dashboardPage, selectors, components });

      await controls.enterEditMode();

      // Move panel three to panel one position
      await movePanel(dashboardPage, selectors, /^Panel three$/, /^Panel one$/);

      // Verify panel three is now above panel one
      const panel3Position = await getPanelPosition(dashboardPage, selectors, /^Panel three$/);
      const panel1Position = await getPanelPosition(dashboardPage, selectors, /^Panel one$/);

      expect(panel3Position?.y).toBeLessThan(panel1Position?.y || 0);

      // Move panel two to panel three position
      await movePanel(dashboardPage, selectors, /^Panel two$/, /^Panel three$/);

      // Verify panel two is now above panel three
      const panel2Position = await getPanelPosition(dashboardPage, selectors, /^Panel two$/);
      const panel3PositionAfter = await getPanelPosition(dashboardPage, selectors, /^Panel three$/);

      expect(panel2Position?.y).toBeLessThan(panel3PositionAfter?.y || 0);
    });
  }
);
