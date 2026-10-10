import { type Locator } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

test.use({
  openFeature: {
    flags: { canvasPanelPanZoom: true },
  },
});
test.describe('Canvas Panel - Scene Tests', () => {
  test.beforeEach(async ({ page, gotoDashboardPage }) => {
    const dashboardPage = await gotoDashboardPage({});
    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.setVisualization('Canvas');

    // Wait for canvas panel to load
    await page.waitForSelector('[data-testid="canvas-scene-pan-zoom"]', { timeout: 10000 });
  });

  test('should create and render canvas panel with scene elements', async ({ page }) => {
    const canvasElement = page.getByRole('button', { name: 'Double click to set field' });
    await expect(canvasElement).toBeVisible();
  });

  test('selects multiple elements with a marquee and clears the selection', async ({ page }) => {
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    const elements = page.getByRole('button', { name: 'Double click to set field' });
    await expect(elements).toHaveCount(2);
    await expect(page.getByRole('treeitem', { selected: true })).toHaveCount(0);
    const first = await elements.first().boundingBox();
    const last = await elements.last().boundingBox();
    expect(first).not.toBeNull();
    expect(last).not.toBeNull();
    // A marquee selects both overlapping elements without a separate drag and Shift-click sequence.
    await page.mouse.move(Math.min(first!.x, last!.x) - 10, Math.min(first!.y, last!.y) - 10);
    await page.mouse.down();
    await page.mouse.move(
      Math.max(first!.x + first!.width, last!.x + last!.width) + 10,
      Math.max(first!.y + first!.height, last!.y + last!.height) + 10,
      { steps: 10 }
    );
    await page.mouse.up();
    await expect(page.getByRole('treeitem', { selected: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Clear selection', exact: true }).click();
    await expect(page.getByRole('treeitem', { selected: true })).toHaveCount(0);
    await expect(elements).toHaveCount(2);
  });

  test('should handle scene pan and zoom when enabled', async ({ page }) => {
    // Feature toggle is enabled, pan/zoom functionality should be available
    const panZoomCheckbox = page.getByRole('switch', { name: 'Pan and zoom' });
    await panZoomCheckbox.setChecked(true, { force: true });
    await expect(panZoomCheckbox).toBeChecked({ checked: true });

    const canvasElement = page.getByRole('button', { name: 'Double click to set field' });
    const canvasSceneWrapper = page.getByTestId('canvas-scene-wrapper');

    // Check if infinite viewer is present (pan/zoom feature)
    await page.waitForSelector('[data-testid="canvas-scene-pan-zoom"]', { timeout: 10000 });
    const infiniteViewer = page.locator('[data-testid="canvas-scene-pan-zoom"]');
    await infiniteViewer.waitFor({ state: 'visible', timeout: 5000 });
    expect(await infiniteViewer.isVisible()).toBe(true);
    await infiniteViewer.hover();

    const viewerBounds = await infiniteViewer.boundingBox();
    expect(viewerBounds).toBeDefined();

    // Test pan functionality
    const startX = viewerBounds!.x + 50;
    const startY = viewerBounds!.y + 50;
    const endX = viewerBounds!.x + 250;
    const endY = viewerBounds!.y + 250;
    page.getByTestId('canvas-scene-pan-zoom');
    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(endX, endY);
    await page.mouse.up({ button: 'middle' });
    expect(await isOutsideViewport(canvasElement, canvasSceneWrapper)).toBe(true);

    // Test zoom reset with double-click
    await page.mouse.dblclick(startX, startY);
    // Verify canvas element is visible after pan/zoom operations
    expect(await isOutsideViewport(canvasElement, canvasSceneWrapper)).toBe(false);

    // Test zoom functionality: zooming in scales the element up
    const widthBeforeZoom = (await canvasElement.boundingBox())!.width;
    await page.mouse.move(startX, startY);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -400); // Zoom in
    await page.keyboard.up('Control');
    expect((await canvasElement.boundingBox())!.width).toBeGreaterThan(widthBeforeZoom);

    // Test zoom reset with double-click restores the original scale
    await page.mouse.dblclick(startX, startY);
    expect((await canvasElement.boundingBox())!.width).toBeCloseTo(widthBeforeZoom, -1);
  });
});

// TODO: this function is workaround for .toBeVisible()
async function isOutsideViewport(element: Locator, viewPort: Locator): Promise<boolean> {
  const elementBounds = await element.boundingBox();
  const viewportBounds = await viewPort.boundingBox();
  return (
    elementBounds!.x + elementBounds!.width < viewportBounds!.x ||
    elementBounds!.x > viewportBounds!.x + viewportBounds!.width ||
    elementBounds!.y + elementBounds!.height < viewportBounds!.y ||
    elementBounds!.y > viewportBounds!.y + viewportBounds!.height
  );
}
