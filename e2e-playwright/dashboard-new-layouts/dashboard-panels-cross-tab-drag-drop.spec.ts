import { type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import v2DashboardTabsWithPanels from '../dashboards/V2DashTabsWithPanelsDnd.json';

import { dragAndDropOpenFeature, expect, test } from './fixtures';
import { flows, getPanelBox, getTabBox, startPointerDrag } from './helpers';
import { type Panels, type Tabs } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: dragAndDropOpenFeature({ dashboardUndoRedo: true }),
  viewport: { width: 1920, height: 1080 },
});

// Tabs of V2DashTabsWithPanelsDnd.json, each an auto grid
const TAB_1_PANELS = ['P1', 'P2', 'P3'];

async function importDashboard(page: Page, selectors: E2ESelectorGroups, title: string) {
  await flows.dashboards.importTestDashboard(page, selectors, title, JSON.stringify(v2DashboardTabsWithPanels), {
    checkPanelsVisible: false,
    requiresDataSourceSelection: false,
  });
}

/** Opens the tab and asserts its grid holds exactly these panels, in order */
async function expectTabPanels(
  { tabs, panels }: { tabs: Tabs; panels: Panels },
  tabTitle: string,
  panelTitles: string[]
) {
  await test.step(`Expect tab "${tabTitle}" to hold ${panelTitles.join(', ')}`, async () => {
    await tabs.select(tabTitle);
    await expect(tabs.getTitle(tabTitle)).toHaveAttribute('aria-selected', 'true');
    await expect(panels.getHeaders(undefined, tabs.getContent(tabTitle))).toHaveText(panelTitles);
  });
}

/** Asserts Tab 1 is untouched: same panels, same order, same geometry (no placeholder left behind) */
async function expectTab1Unchanged(
  { tabs, panels }: { tabs: Tabs; panels: Panels },
  boxesBefore: Array<{ x: number; y: number; width: number; height: number }>
) {
  await expect(tabs.getTitle('Tab 1')).toHaveAttribute('aria-selected', 'true');
  await expect(panels.getHeaders(undefined, tabs.getContent('Tab 1'))).toHaveText(TAB_1_PANELS);
  await expect(async () => {
    for (const [index, title] of TAB_1_PANELS.entries()) {
      const box = await getPanelBox(panels, title);
      expect(box.x).toBeCloseTo(boxesBefore[index].x, 0);
      expect(box.y).toBeCloseTo(boxesBefore[index].y, 0);
      expect(box.width).toBeCloseTo(boxesBefore[index].width, 0);
      expect(box.height).toBeCloseTo(boxesBefore[index].height, 0);
    }
  }).toPass();
}

async function getTab1PanelBoxes(panels: Panels) {
  const boxes = [];
  for (const title of TAB_1_PANELS) {
    boxes.push(await getPanelBox(panels, title));
  }
  return boxes;
}

test.describe('Dashboard panels cross-tab drag and drop', { tag: ['@dashboards', '@drag-and-drop'] }, () => {
  test.describe('Cancelled drops', () => {
    test('keeps the panel in place when it is dropped between tab headers', async ({
      page,
      selectors,
      controls,
      sidebar,
      tabs,
      panels,
    }) => {
      await importDashboard(page, selectors, 'Drop panel on tab bar');
      await controls.enterEditMode();
      await expect(panels.getHeaders(undefined, tabs.getContent('Tab 1'))).toHaveText(TAB_1_PANELS);
      const boxesBefore = await getTab1PanelBoxes(panels);

      const tab1Box = await getTabBox(tabs, 'Tab 1');
      const tab2Box = await getTabBox(tabs, 'Tab 2');
      const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));
      await drag.moveToPoint({
        x: (tab1Box.x + tab1Box.width + tab2Box.x) / 2,
        y: tab1Box.y + tab1Box.height / 2,
      });
      await drag.drop();

      await expectTab1Unchanged({ tabs, panels }, boxesBefore);
      await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
      await expectTabPanels({ tabs, panels }, 'Tab 2', ['Q1']);
    });

    // Today Escape does not cancel a panel drag: the release still commits the move
    test.fixme(
      'keeps the panel in place when the drag is cancelled with Escape',
      async ({ page, selectors, controls, sidebar, tabs, panels }) => {
        await importDashboard(page, selectors, 'Cancel panel drag with Escape');
        await controls.enterEditMode();
        const boxesBefore = await getTab1PanelBoxes(panels);

        const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));
        await drag.moveTo(panels.getHeader('P3'));
        await drag.pressEscape();
        await drag.drop();

        await expectTab1Unchanged({ tabs, panels }, boxesBefore);
        await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
      }
    );

    // Today a release outside the viewport never ends the drag: the panel is left floating off-screen
    test.fixme(
      'keeps the panel in place when it is dropped outside the browser viewport',
      async ({ page, selectors, controls, sidebar, tabs, panels }) => {
        await importDashboard(page, selectors, 'Drop panel outside viewport');
        await controls.enterEditMode();
        const boxesBefore = await getTab1PanelBoxes(panels);

        const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));
        // straight to the left, so the pointer leaves the viewport without crossing other panels
        await drag.moveToPoint({ x: -50, y: boxesBefore[0].y + 10 });
        await drag.drop();

        await expectTab1Unchanged({ tabs, panels }, boxesBefore);
        await expect(sidebar.toolbar.getButton('Undo')).toBeDisabled();
      }
    );
  });

  test('opens a hovered tab after the activation delay and drops the panel into it', async ({
    page,
    selectors,
    controls,
    sidebar,
    tabs,
    panels,
  }) => {
    // drag, undo/redo, then save and reload
    test.slow();
    const layout = { tabs, panels };
    await importDashboard(page, selectors, 'Drag panel into another tab');
    await controls.enterEditMode();
    await expect(tabs.getTitle('Tab 1')).toHaveAttribute('aria-selected', 'true');

    const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));

    // A brief hover over Tab 2, then moving away, must not open it, even once the delay has elapsed
    await drag.moveTo(tabs.getTitle('Tab 2'));
    await page.waitForTimeout(200);
    const tab2Box = await getTabBox(tabs, 'Tab 2');
    await drag.moveToPoint({ x: tab2Box.x + tab2Box.width / 2, y: tab2Box.y + 150 });
    await page.waitForTimeout(1000);
    await expect(tabs.getTitle('Tab 1')).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getTitle('Tab 2')).toHaveAttribute('aria-selected', 'false');

    // Holding over Tab 3 opens it while the panel is still being dragged
    await drag.moveTo(tabs.getTitle('Tab 3'));
    await expect(tabs.getTitle('Tab 3')).toHaveAttribute('aria-selected', 'true');
    await expect(panels.getPanel('R1')).toBeVisible();

    // drop on the right half of R1, so P1 lands after it
    const r1Box = await getPanelBox(panels, 'R1');
    await drag.moveToPoint({ x: r1Box.x + r1Box.width * 0.75, y: r1Box.y + r1Box.height / 2 });
    await drag.drop();

    const expectMoved = async () => {
      await expectTabPanels(layout, 'Tab 3', ['R1', 'P1']);
      await expectTabPanels(layout, 'Tab 1', ['P2', 'P3']);
      await expectTabPanels(layout, 'Tab 2', ['Q1']);
    };
    await expectMoved();

    await sidebar.toolbar.clickButton('Undo');
    await expectTabPanels(layout, 'Tab 1', TAB_1_PANELS);
    await expectTabPanels(layout, 'Tab 3', ['R1']);

    await sidebar.toolbar.clickButton('Redo');
    await expectMoved();

    await flows.dashboards.saveDashboard(page, controls);
    await expectMoved();
  });
});
