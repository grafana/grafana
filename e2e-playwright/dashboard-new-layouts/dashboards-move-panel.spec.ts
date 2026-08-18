import { test, expect } from './fixtures';
import { getPanelBox, movePanel } from './helpers';

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
    test('can drag and drop panels', async ({ gotoDashboardPage, controls, panels }) => {
      await gotoDashboardPage({ uid: `${PAGE_UNDER_TEST}?orgId=1` });
      await controls.enterEditMode();

      // Move panel three to panel one position
      await movePanel(panels, /^Panel three$/, /^Panel one$/);

      // Verify panel three is now above panel one
      const panel3Box = await getPanelBox(panels, 'Panel three');
      const panel1Box = await getPanelBox(panels, 'Panel one');

      expect(panel3Box.y).toBeLessThan(panel1Box.y);

      // Move panel two to panel three position
      await movePanel(panels, /^Panel two$/, /^Panel three$/);

      // Verify panel two is now above panel three
      const panel2Box = await getPanelBox(panels, 'Panel two');
      const panel3BoxAfter = await getPanelBox(panels, 'Panel three');

      expect(panel2Box.y).toBeLessThan(panel3BoxAfter.y);
    });
  }
);
