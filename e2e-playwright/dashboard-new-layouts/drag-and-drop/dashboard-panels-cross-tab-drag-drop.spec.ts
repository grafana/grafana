import { type APIRequestContext, type Page } from '@playwright/test';

import { type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { test, expect } from '../fixtures';
import { dragAndDrop, flows, getPanelBox, getTabBox, startPointerDrag } from '../helpers';
import { type Panels, type Tabs } from '../page-objects';

import { buildDashboardTabsWithPanelsSpec } from './fixtures/dashboard-tabs-with-panels-spec';

test.use({
  // the Undo/Redo toolbar buttons are gated by an OpenFeature flag, not a feature toggle
  openFeature: {
    flags: {
      dashboardUndoRedo: true,
    },
  },
  viewport: { width: 1920, height: 1080 },
});

const TAB_1_PANELS = ['P1', 'P2', 'P3'];
// how long a tab has to be hovered during a drag before it opens
const TAB_ACTIVATION_DELAY_MS = 600;
// how far ahead of the page clock to pause it, enough to cover the round trips on a slow runner
const CLOCK_PAUSE_LEAD_MS = 5_000;

async function openDashboard(page: Page, request: APIRequestContext, selectors: E2ESelectorGroups) {
  await flows.dashboards.createAndOpenDashboard({
    page,
    request,
    selectors,
    spec: buildDashboardTabsWithPanelsSpec,
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

test.describe('Dashboard panels cross-tab drag and drop', { tag: ['@dashboards'] }, () => {
  test.describe('Cancelled drops', () => {
    test('keeps the panel in place when it is dropped between tab headers', async ({
      page,
      request,
      selectors,
      controls,
      tabs,
      panels,
    }) => {
      await openDashboard(page, request, selectors);
      await controls.enterEditMode();
      await expect(panels.getHeaders(undefined, tabs.getContent('Tab 1'))).toHaveText(TAB_1_PANELS);
      const boxesBefore = await getTab1PanelBoxes(panels);

      await dragAndDrop(
        page,
        'panel "P1"',
        panels.getHeader('P1'),
        'the gap between the Tab 1 and Tab 2 headers',
        async () => {
          const tab1Box = await getTabBox(tabs, 'Tab 1');
          const tab2Box = await getTabBox(tabs, 'Tab 2');
          return { x: (tab1Box.x + tab1Box.width + tab2Box.x) / 2, y: tab1Box.y + tab1Box.height / 2 };
        }
      );

      await expectTab1Unchanged({ tabs, panels }, boxesBefore);
      await expect(controls.getUndoButton()).toBeDisabled();
      await expectTabPanels({ tabs, panels }, 'Tab 2', ['Q1']);
    });

    // Today Escape does not cancel a panel drag: the release still commits the move
    test.fixme(
      'keeps the panel in place when the drag is cancelled with Escape',
      async ({ page, request, selectors, controls, tabs, panels }) => {
        await openDashboard(page, request, selectors);
        await controls.enterEditMode();
        const boxesBefore = await getTab1PanelBoxes(panels);

        await test.step('Drag P1 over P3, press Escape, then release', async () => {
          const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));
          await drag.moveTo(panels.getHeader('P3'));
          await drag.pressEscape();
          await drag.drop();
        });

        await expectTab1Unchanged({ tabs, panels }, boxesBefore);
        await expect(controls.getUndoButton()).toBeDisabled();
      }
    );

    // Today a release outside the viewport never ends the drag: the panel is left floating off-screen
    test.fixme(
      'keeps the panel in place when it is dropped outside the browser viewport',
      async ({ page, request, selectors, controls, tabs, panels }) => {
        await openDashboard(page, request, selectors);
        await controls.enterEditMode();
        const boxesBefore = await getTab1PanelBoxes(panels);

        // straight to the left, so the pointer leaves the viewport without crossing other panels
        await dragAndDrop(
          page,
          'panel "P1"',
          panels.getHeader('P1'),
          'a point past the left edge of the viewport',
          async () => ({ x: -50, y: boxesBefore[0].y + 10 })
        );

        await expectTab1Unchanged({ tabs, panels }, boxesBefore);
        await expect(controls.getUndoButton()).toBeDisabled();
      }
    );
  });

  test('opens a hovered tab after the activation delay and drops the panel into it', async ({
    page,
    request,
    selectors,
    controls,
    tabs,
    panels,
  }) => {
    const layout = { tabs, panels };
    // time flows normally until the clock is paused, then only advances when the test says so
    await page.clock.install();
    await openDashboard(page, request, selectors);
    await controls.enterEditMode();
    await expect(tabs.getTitle('Tab 1')).toHaveAttribute('aria-selected', 'true');

    const drag = await startPointerDrag(page, 'panel "P1"', panels.getHeader('P1'));
    // The page clock keeps ticking until the pause lands, and pausing in the past throws, so aim
    // well ahead of it; no tab is hovered yet, so the jump cannot fire an activation timer
    const pageNow = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(pageNow + CLOCK_PAUSE_LEAD_MS);

    await test.step('Hover Tab 2 for less than the activation delay, then move away', async () => {
      await drag.moveTo(tabs.getTitle('Tab 2'));
      await page.clock.runFor(TAB_ACTIVATION_DELAY_MS - 200);
      const tab2Box = await getTabBox(tabs, 'Tab 2');
      await drag.moveToPoint({ x: tab2Box.x + tab2Box.width / 2, y: tab2Box.y + 150 });
      // well past the moment Tab 2 would have opened, had its timer not been cleared
      await page.clock.runFor(TAB_ACTIVATION_DELAY_MS * 2);
    });
    await expect(tabs.getTitle('Tab 1')).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getTitle('Tab 2')).toHaveAttribute('aria-selected', 'false');

    await test.step('Hold over Tab 3 past the activation delay', async () => {
      await drag.moveTo(tabs.getTitle('Tab 3'));
      await page.clock.runFor(TAB_ACTIVATION_DELAY_MS + 100);
    });
    await page.clock.resume();
    await expect(tabs.getTitle('Tab 3')).toHaveAttribute('aria-selected', 'true');
    await expect(panels.getPanel('R1')).toBeVisible();

    await test.step('Drop P1 on the right half of R1', async () => {
      const r1Box = await getPanelBox(panels, 'R1');
      await drag.moveToPoint({ x: r1Box.x + r1Box.width * 0.75, y: r1Box.y + r1Box.height / 2 });
      await drag.drop();
    });

    const expectMoved = async () => {
      await expectTabPanels(layout, 'Tab 3', ['R1', 'P1']);
      await expectTabPanels(layout, 'Tab 1', ['P2', 'P3']);
      await expectTabPanels(layout, 'Tab 2', ['Q1']);
    };
    await expectMoved();

    await controls.undo();
    await expectTabPanels(layout, 'Tab 1', TAB_1_PANELS);
    await expectTabPanels(layout, 'Tab 3', ['R1']);

    await controls.redo();
    await expectMoved();

    await flows.dashboards.saveDashboard(page, controls);
    await expectMoved();
  });
});
