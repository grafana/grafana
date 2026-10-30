import { type Locator } from '@playwright/test';

import v2DashboardCustomGrid from '../dashboards/V2DashCustomGridDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { expectPanelBoxesToBe, flows, getPanelBox, getPanelBoxes, startPointerDrag } from './helpers';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

const PANEL_TITLES = 'ABCDEFGHIJKLMNOP'.split('').map((letter) => `Panel ${letter}`);

/** A custom grid much taller than the viewport: 16 panels of 12 x 8 cells, two per line */
function longCustomGridDashboard() {
  const [template] = Object.values(v2DashboardCustomGrid.spec.elements);
  const elements = Object.fromEntries(
    PANEL_TITLES.map((title, index) => [
      `panel-${index + 1}`,
      { ...template, spec: { ...template.spec, id: index + 1, title } },
    ])
  );
  const items = PANEL_TITLES.map((_, index) => ({
    kind: 'GridLayoutItem',
    spec: {
      x: (index % 2) * 12,
      y: Math.floor(index / 2) * 8,
      width: 12,
      height: 8,
      element: { kind: 'ElementReference', name: `panel-${index + 1}` },
    },
  }));
  return {
    ...v2DashboardCustomGrid,
    spec: { ...v2DashboardCustomGrid.spec, elements, layout: { kind: 'GridLayout', spec: { items } } },
  };
}

function getScrollTop(scrollContainer: Locator) {
  return scrollContainer.evaluate((element) => element.scrollTop);
}

test.describe(
  'Dashboard auto-scroll while dragging',
  {
    tag: ['@dashboards', '@drag-and-drop'],
  },
  () => {
    test('scrolls a long dashboard while a panel is held at its bottom edge, so the panel drops further down', async ({
      page,
      selectors,
      controls,
      sidebar,
      panels,
      unifiedDragAndDrop,
    }) => {
      test.skip(!unifiedDragAndDrop, 'Only the unified drag and drop engine scrolls while dragging');
      await flows.dashboards.importTestDashboard(
        page,
        selectors,
        'Custom grid auto-scroll',
        JSON.stringify(longCustomGridDashboard()),
        { checkPanelsVisible: false, requiresDataSourceSelection: false }
      );
      await controls.enterEditMode();
      // The dashboard scrolls in its own container next to the edit pane, not in the document
      const scrollContainer = page.getByTestId(selectors.components.DashboardSidebarSplitter.bodyContainer);
      const containerBox = (await scrollContainer.boundingBox())!;
      const initialBoxes = await getPanelBoxes(panels, PANEL_TITLES.slice(0, 4));
      const header = (await panels.getHeader(/^Panel A$/).boundingBox())!;
      // Where startPointerDrag holds the panel: the middle of its header
      const grabOffsetY = header.y + header.height / 2 - initialBoxes['Panel A'].y;

      const drag = await startPointerDrag(page, 'panel "Panel A"', panels.getHeader(/^Panel A$/));
      const edge = { x: containerBox.x + containerBox.width / 4, y: containerBox.y + containerBox.height - 10 };
      await drag.moveToPoint(edge);

      // The pointer rests while the dashboard scrolls under it
      await expect.poll(() => getScrollTop(scrollContainer), { timeout: 10_000 }).toBeGreaterThan(600);
      // The dragged panel stays under the pointer, in the viewport
      const dragged = await getPanelBox(panels, 'Panel A');
      expect(Math.abs(dragged.y + grabOffsetY - edge.y)).toBeLessThanOrEqual(3);

      await drag.drop();
      const scrollTop = await getScrollTop(scrollContainer);
      const dropped = await getPanelBox(panels, 'Panel A');
      // In the dashboard's own coordinates, the panel landed far below where it was
      expect(dropped.y + scrollTop - initialBoxes['Panel A'].y).toBeGreaterThan(600);

      await sidebar.toolbar.clickButton('Undo');
      await scrollContainer.evaluate((element) => element.scrollTo(0, 0));
      await expectPanelBoxesToBe(panels, initialBoxes);
    });
  }
);
