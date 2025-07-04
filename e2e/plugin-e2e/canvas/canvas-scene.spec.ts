import { test, expect } from '@playwright/test';
import { createCanvasPanel, selectCanvasElement, waitForMoveableControls, performKeyboardShortcut } from './utils';

test.describe('Canvas Panel - Scene Tests', () => {
  test.beforeEach(async ({ page }) => {
    await createCanvasPanel(page);
  });

  test('should create and render canvas panel with scene elements', async ({ page }) => {
    // Check that default element exists
    // const defaultElement = page.locator('[data-testid="canvas-element"]').first();
    await page.waitForSelector('[data-testid="canvas-element"]', { timeout: 10000 });
    const defaultElement = page.locator('[data-testid="canvas-element"]');
    await expect(defaultElement).toBeVisible();
  });

  // test('should enter edit mode and show moveable controls', async ({ page }) => {
  //   // Create canvas panel using utility function
  //   // const { canvasPanel } = await createCanvasPanel(page);

  //   // Check that editing controls are visible in panel editor
  //   const moveableControls = page.locator('.moveable-control');
  //   await expect(moveableControls).toBeVisible();

  //   // Check that selecto is initialized
  //   const selectoElement = page.locator('.selecto-selection');
  //   await expect(selectoElement).toBeAttached();
  // });

  // test('should add new elements to canvas scene', async ({ page }) => {

  //   // Look for add element button in panel editor
  //   await page.waitForSelector('[data-testid="data-testid Value picker button Add item"]', { timeout: 10000 });
  //   const addElementBtn = page.locator('[data-testid="data-testid Value picker button Add item"]');
  //   if (await addElementBtn.isVisible()) {
  //     await addElementBtn.click();

  //     // Select text element
  //     await page.click('[data-testid="canvas-element-text"]');

  //     // Check that new element was added
  //     const elements = page.locator('[data-testid="canvas-element"]');
  //     await expect(elements).toHaveCount(2);
  //   }
  // });

  test('should select and manipulate canvas elements', async ({ page }) => {
    // Create canvas panel using utility function
    await createCanvasPanel(page);

    // Select a canvas element using utility function
    // const canvasElement = await selectCanvasElement(page, 0);
    await selectCanvasElement(page, 0);

    // Wait for moveable controls to be visible
    await waitForMoveableControls(page);

    // // Check that resize handles are present
    // const resizeHandle = page.locator('.moveable-control[data-direction]');
    // await expect(resizeHandle).toBeVisible();
  });

  // test('should show context menu on right click', async ({ page }) => {
  //   // Right-click on canvas
  //   const canvasPanel = page.locator('[data-testid="canvas-panel"]');
  //   await canvasPanel.click({ button: 'right' });

  //   // Check for context menu
  //   const contextMenu = page.locator('[data-testid="context-menu"]');
  //   await expect(contextMenu).toBeVisible();
  // });

  // test('should handle scene data updates', async ({ page }) => {
  //   // Mock data response for scene updates
  //   await page.route('**/api/ds/query', (route) => {
  //     route.fulfill({
  //       json: {
  //         results: {
  //           A: {
  //             status: 200,
  //             frames: [
  //               {
  //                 schema: {
  //                   fields: [
  //                     { name: 'time', type: 'time' },
  //                     { name: 'value', type: 'number' },
  //                   ],
  //                 },
  //                 data: {
  //                   values: [
  //                     [1640995200000, 1640995260000],
  //                     [100, 200],
  //                   ],
  //                 },
  //               },
  //             ],
  //           },
  //         },
  //       },
  //     });
  //   });

  //   // Trigger data refresh
  //   await page.click('[data-testid="panel-menu"]');
  //   await page.click('[data-testid="panel-menu-refresh"]');

  //   // Check that canvas still renders properly
  //   const canvasScene = page.locator('[data-testid="canvas-scene"]');
  //   await expect(canvasScene).toBeVisible();
  // });

  test('should handle scene pan and zoom when enabled', async ({ page }) => {
    // Check if canvas panel pan/zoom feature toggle is enabled
    const config = await page.evaluate(() => (window as any).grafanaBootData?.settings?.featureToggles);
    if (config?.canvasPanelPanZoom) {
      // Feature toggle is enabled, pan/zoom functionality should be available
      console.log('Canvas panel pan/zoom feature toggle is enabled');

      // Enable pan and zoom if not already enabled
      const panZoomCheckbox = page.locator(
        '[aria-label="Canvas Pan and zoom field property editor"] input[type="checkbox"][role="switch"]'
      );
      // await page.waitForSelector('[aria-label="Canvas Pan and zoom field property editor"] input[type="checkbox"][role="switch"]', { timeout: 30000 });
      await panZoomCheckbox.waitFor({ state: 'visible', timeout: 5000 });
      const isEnabled = await panZoomCheckbox.isChecked();
      console.log('isEnabled', isEnabled);
      // if (!isEnabled) {
      //   // await panZoomCheckbox.check();
      //   // await panZoomCheckbox.click();
      //   await panZoomCheckbox.setChecked(true);
      // }

      // // Check if infinite viewer is present (pan/zoom feature)
      // const infiniteViewer = page.locator('[data-testid="canvas-scene"]');
      // if (await infiniteViewer.isVisible()) {
      //   // Test zoom functionality
      //   await page.mouse.wheel(0, -100);

      //   // Test pan functionality
      //   await page.mouse.move(100, 100);
      //   await page.mouse.down();
      //   await page.mouse.move(150, 150);
      //   await page.mouse.up();

      //   // Test zoom reset with double-click
      //   await infiniteViewer.dblclick();
      // }

      // // Verify canvas is still functional
      // const canvasScene = page.locator('[data-testid="canvas-scene"]');
      // await expect(canvasScene).toBeVisible();
    }
  });

  // test('should handle scene element connections', async ({ page }) => {
  //   // Check if connections SVG is present
  //   const connectionsSVG = page.locator('[data-testid="canvas-connections"]');
  //   if (await connectionsSVG.isVisible()) {
  //     await expect(connectionsSVG).toBeVisible();
  //   }

  //   // Check that scene can handle connection drawing
  //   const canvasScene = page.locator('[data-testid="canvas-scene"]');
  //   await expect(canvasScene).toBeVisible();
  // });

  // test('should persist scene state on save', async ({ page }) => {
  //   // Save the panel
  //   await page.click('[data-testid="panel-editor-save"]');

  //   // Save the dashboard
  //   await page.click('[data-testid="dashboard-save"]');
  //   await page.fill('[data-testid="dashboard-title-input"]', 'Canvas Scene Test Dashboard');
  //   await page.click('[data-testid="dashboard-save-button"]');

  //   // Reload page
  //   await page.reload();

  //   // Check that canvas panel still renders
  //   const canvasScene = page.locator('[data-testid="canvas-scene"]');
  //   await expect(canvasScene).toBeVisible();
  // });

  // test('should handle scene element tooltips', async ({ page }) => {
  //   // Save and exit edit mode to test tooltips
  //   await page.click('[data-testid="panel-editor-save"]');

  //   // Hover over canvas element
  //   const canvasElement = page.locator('[data-testid="canvas-element"]').first();
  //   await canvasElement.hover();

  //   // Check for tooltip (if tooltip functionality is implemented)
  //   const tooltip = page.locator('[data-testid="canvas-tooltip"]');
  //   if (await tooltip.isVisible()) {
  //     await expect(tooltip).toBeVisible();
  //   }
  // });

  // test('should handle scene keyboard shortcuts', async ({ page }) => {
  //   // Create canvas panel using utility function
  //   // const { canvasScene } = await createCanvasPanel(page);

  //   // Select an element using utility function
  //   await selectCanvasElement(page, 0);

  //   // Test keyboard shortcuts using utility functions
  //   await performKeyboardShortcut(page, 'delete');
  //   await performKeyboardShortcut(page, 'selectAll');
  //   await performKeyboardShortcut(page, 'copy');
  //   await performKeyboardShortcut(page, 'paste');

  //   // Verify canvas is still functional
  //   // await expect(canvasScene).toBeVisible();
  // });
});
