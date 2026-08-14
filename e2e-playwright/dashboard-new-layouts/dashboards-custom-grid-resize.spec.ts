import { type Page } from '@playwright/test';

import { type DashboardPage, type DashboardPageArgs, type E2ESelectorGroups } from '@grafana/plugin-e2e';

import { test, expect } from './fixtures';
import { getPanelBox, flows, undockMegaMenu } from './helpers';
import { type Panels, type Sidebar } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.use({
  viewport: { width: 1920, height: 1080 },
});

test.describe(
  'Dashboard custom grid resize',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('can resize a panel by dragging its corner', async ({
      gotoDashboardPage,
      page,
      selectors,
      controls,
      sidebar,
      panels,
    }) => {
      await prepareTestDashboard(gotoDashboardPage, selectors, sidebar);

      const panelBoxBeforeResize = await getPanelBox(panels, 'New panel');

      await dragResizeCorner(page, panels, 'New panel', { deltaX: 160, deltaY: 120 });

      // Poll: layout settles after the resize gesture
      await expect(async () => {
        const panelBox = await getPanelBox(panels, 'New panel');
        expect(panelBox.width, 'Panel width should increase after resize').toBeGreaterThan(panelBoxBeforeResize.width);
        expect(panelBox.height, 'Panel height should increase after resize').toBeGreaterThan(
          panelBoxBeforeResize.height
        );
      }).toPass();

      const panelBoxAfterResize = await getPanelBox(panels, 'New panel');

      const uniqueTitle = `${test.info().title} [${Date.now().toString(36)}-${test.info().workerIndex}]`;
      await flows.dashboards.saveDashboardAndCloseToast(page, controls, uniqueTitle);

      await page.reload();

      // Poll while panels re-render after reload (±1px for edit/view chrome / scrollbar shifts)
      await expect(async () => {
        const panelBox = await getPanelBox(panels, 'New panel');
        expect(Math.abs(panelBox.width - panelBoxAfterResize.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(panelBox.height - panelBoxAfterResize.height)).toBeLessThanOrEqual(1);
      }).toPass();
    });

    test('cannot resize a panel wider than the dashboard', async ({
      gotoDashboardPage,
      page,
      selectors,
      sidebar,
      canvas,
      panels,
    }) => {
      await prepareTestDashboard(gotoDashboardPage, selectors, sidebar);

      const panelBoxBeforeResize = await getPanelBox(panels, 'New panel');

      const canvasBox = await canvas.getContainer().boundingBox();
      expect(canvasBox, 'The canvas should have a bounding box').not.toBeNull();

      // Drag far past the right edge of the canvas; height still grows so the gesture is real
      await dragResizeCorner(page, panels, 'New panel', {
        deltaX: Math.ceil(canvasBox!.width) + 400,
        deltaY: 120,
      });

      await expect(async () => {
        const panelBox = await getPanelBox(panels, 'New panel');
        expect(panelBox.height, 'Panel height should increase after resize').toBeGreaterThan(
          panelBoxBeforeResize.height
        );

        const canvasBox = await canvas.getContainer().boundingBox();
        expect(canvasBox, 'The canvas should have a bounding box').not.toBeNull();

        expect(panelBox.x + panelBox.width, 'Panel right edge must stay within the canvas').toBeLessThanOrEqual(
          canvasBox!.x + canvasBox!.width + 1
        );
        expect(panelBox.width, 'Panel must not exceed the dashboard canvas width').toBeLessThanOrEqual(
          canvasBox!.width + 1
        );
      }).toPass();
    });
  }
);

async function prepareTestDashboard(
  gotoDashboardPage: (args: DashboardPageArgs) => Promise<DashboardPage>,
  selectors: E2ESelectorGroups,
  sidebar: Sidebar
) {
  const dashboardPage = await gotoDashboardPage({});
  await undockMegaMenu(dashboardPage, selectors);

  await sidebar.addOptions.clickNewPanelButton();
  await sidebar.clickCloseButton();
}

/**
 * Drags the panel's bottom-right resize corner by the given deltas.
 * Uses the raw mouse API because the handle is a small absolute overlay; stays in the
 * spec per the timing-sensitive-mechanics rule.
 */
async function dragResizeCorner(
  page: Page,
  panels: Panels,
  panelTitle: string,
  { deltaX, deltaY }: { deltaX: number; deltaY: number }
) {
  await test.step(`Resize panel "${panelTitle}" by ${deltaX}px x ${deltaY}px`, async () => {
    const handle = page
      .locator('[data-griditem-key]')
      .filter({ has: panels.getPanel(panelTitle) })
      .locator('.scene-resize-handle');

    const box = await handle.boundingBox();
    expect(box, `Resize handle for panel "${panelTitle}" should be visible`).not.toBeNull();

    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + deltaX, centerY + deltaY, { steps: 12 });
    await page.mouse.up();
  });
}
