import v2DashboardCustomGrid from '../dashboards/V2DashCustomGridDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { expectPanelBoxesToBe, flows, getPanelBox } from './helpers';

// Custom grid of V2DashCustomGridDnd.json: 12 x 8 cells, two per line
const GRID_MARGIN = 8;
const CELL_HEIGHT = 8 * 30 + 7 * GRID_MARGIN;

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  openFeature: dragAndDropOpenFeature(),
  viewport: { width: 1920, height: 1080 },
});

// Runs in both drag and drop projects, so it compares the react-grid-layout grid (flag off) with the
// new custom grid (flag on) against the same expected geometry
test.describe(
  'Dashboard',
  {
    tag: ['@dashboards', '@drag-and-drop'],
  },
  () => {
    test('renders custom grid panels at their grid positions in edit mode', async ({
      page,
      selectors,
      controls,
      panels,
      unifiedDragAndDrop,
    }) => {
      // imports a dashboard before entering edit mode
      test.slow();
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid render',
        JSON.stringify(v2DashboardCustomGrid),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();

      await expect(page.locator('[data-custom-grid]')).toHaveCount(unifiedDragAndDrop ? 1 : 0);

      // The two columns fill the layout container
      const container = await page.getByTestId(selectors.components.LayoutContainer('')).boundingBox();
      expect(container, 'The layout container should have a bounding box').not.toBeNull();
      const cellWidth = (container!.width - GRID_MARGIN) / 2;
      const first = await getPanelBox(panels, 'Panel one');
      expect(Math.abs(first.x - container!.x), 'Panel one should start at the left of the grid').toBeLessThanOrEqual(2);

      const nextColumnX = first.x + cellWidth + GRID_MARGIN;
      const nextLineY = first.y + CELL_HEIGHT + GRID_MARGIN;

      await expectPanelBoxesToBe(panels, {
        'Panel one': { x: first.x, y: first.y, width: cellWidth, height: CELL_HEIGHT },
        'Panel two': { x: nextColumnX, y: first.y, width: cellWidth, height: CELL_HEIGHT },
        'Panel three': { x: first.x, y: nextLineY, width: cellWidth, height: CELL_HEIGHT },
        'Panel four': { x: nextColumnX, y: nextLineY, width: cellWidth, height: CELL_HEIGHT },
      });
    });
  }
);
