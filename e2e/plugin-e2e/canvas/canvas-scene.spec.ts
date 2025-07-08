import { test, expect, Page } from '@playwright/test';

// TODO: Check if this is the correct way to check if the feature toggle is enabled
test.use({
  featureToggles: {
    canvasPanelPanZoom: true,
  },
});

test.describe('Canvas Panel - Scene Tests', () => {
  test.beforeEach(async ({ page }) => {
    await createCanvasPanel(page);
  });

  test('should create and render canvas panel with scene elements', async ({ page }) => {
    // TODO: Check if this is the correct element selector
    const canvasElement = await page.getByRole('button', { name: 'Double click to set field' });
    await expect(canvasElement).toBeVisible();
  });

  test('should handle scene pan and zoom when enabled', async ({ page }) => {
    // Check if canvas panel pan/zoom feature toggle is enabled
    // TODO: Check if this is the correct way to check if the feature toggle is enabled
    const config = await page.evaluate(() => (window as any).grafanaBootData?.settings?.featureToggles);
    if (config?.canvasPanelPanZoom) {
      // Feature toggle is enabled, pan/zoom functionality should be available
      await page.getByLabel('Canvas Pan and zoom field').locator('label').nth(1);
      const panZoomCheckbox = page.getByLabel('Canvas Pan and zoom field').locator('label').nth(1);
      const isEnabled = await panZoomCheckbox.isChecked();
      if (!isEnabled) {
        await panZoomCheckbox.setChecked(true);
      }
      await expect(page.getByLabel('Canvas Pan and zoom field').locator('label').nth(1)).toBeChecked({ checked: true });

      // Check if infinite viewer is present (pan/zoom feature)
      await page.waitForSelector('[data-testid="canvas-scene-pan-zoom"]', { timeout: 10000 });
      const infiniteViewer = page.locator('[data-testid="canvas-scene-pan-zoom"]');
      await infiniteViewer.waitFor({ state: 'visible', timeout: 5000 });
      if (await infiniteViewer.isVisible()) {
        await infiniteViewer.hover();
        const viewerBounds = await infiniteViewer.boundingBox();
        if (viewerBounds) {
          // Test pan functionality
          const startX = viewerBounds.x + 50;
          const startY = viewerBounds.y + 50;
          const endX = viewerBounds.x + 250;
          const endY = viewerBounds.y + 250;
          await page.getByTestId('canvas-scene-pan-zoom');
          await page.mouse.move(startX, startY);
          await page.mouse.down({ button: 'middle' });
          await page.mouse.move(endX, endY);
          await page.mouse.up({ button: 'middle' });

          // Check if canvas element is not visible after pan/zoom operations
          let canvasElement = await page.getByRole('button', { name: 'Double click to set field' });
          // TODO: This is checking if the element is outside the viewport; move this to a separate function to reuse it for zoom tests
          // Get element bounds to check if it's outside viewport
          let canvasSceneWrapper = page.locator('[data-testid="canvas-scene-wrapper"]');
          let elementBounds = await canvasElement.boundingBox();
          let viewportBounds = await canvasSceneWrapper.boundingBox();

          if (elementBounds && viewportBounds) {
            // Check if element is outside the viewport bounds
            const isOutsideViewport =
              elementBounds.x + elementBounds.width < viewportBounds.x ||
              elementBounds.x > viewportBounds.x + viewportBounds.width ||
              elementBounds.y + elementBounds.height < viewportBounds.y ||
              elementBounds.y > viewportBounds.y + viewportBounds.height;

            expect(isOutsideViewport).toBe(true);
          }

          // Test zoom reset with double-click
          await page.mouse.dblclick(startX, startY);
          // Verify canvas element is visible after pan/zoom operations
          await expect(canvasElement).toBeVisible();

          // Test zoom functionality
          await page.mouse.move(startX, startY);
          await page.keyboard.down('Control');
          await page.mouse.wheel(0, -400); // Zoom in
          await page.keyboard.up('Control');

          // Check if canvas element is not visible after pan/zoom operations
          canvasElement = await page.getByRole('button', { name: 'Double click to set field' });
          // Check if element exists in DOM but is outside viewport
          await expect(canvasElement).toBeAttached(); // Element should still exist in DOM

          // Get element bounds to check if it's outside viewport
          canvasSceneWrapper = page.locator('[data-testid="canvas-scene-wrapper"]');
          elementBounds = await canvasElement.boundingBox();
          viewportBounds = await canvasSceneWrapper.boundingBox();

          if (elementBounds && viewportBounds) {
            // Check if element is outside the viewport bounds
            const isOutsideViewport =
              elementBounds.x + elementBounds.width < viewportBounds.x ||
              elementBounds.x > viewportBounds.x + viewportBounds.width ||
              elementBounds.y + elementBounds.height < viewportBounds.y ||
              elementBounds.y > viewportBounds.y + viewportBounds.height;

            expect(isOutsideViewport).toBe(true);
          }

          // Test zoom reset with double-click
          await page.mouse.dblclick(startX, startY);
          // Verify canvas element is visible after pan/zoom operations
          await expect(canvasElement).toBeVisible();
        }
      }
    }
  });
});

async function createCanvasPanel(page: Page): Promise<void> {
  // Navigate to Grafana
  await page.goto('/dashboards');

  // Check if we're on a login page and fill form only if needed
  try {
    const userInput = page.locator('input[name="user"]');
    await userInput.waitFor({ state: 'visible', timeout: 5000 });

    // We're on login page, fill the form
    await page.fill('input[name="user"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Handle the "Skip change password" form that appears after login
    try {
      const skipButton = page.locator('[data-testid="data-testid Skip change password button"]');
      await skipButton.waitFor({ state: 'visible', timeout: 5000 });
      await skipButton.click();
    } catch (error) {
      // Skip button didn't appear, continue with test
    }
  } catch (error) {
    // Not on login page, already logged in or different page
    console.log('Login form not found, assuming already logged in');
  }

  // Wait for dashboard to load (wait for the New button to be available)
  await page.waitForSelector('button:has-text("New")', { timeout: 30000 });

  // Create a new dashboard
  await page.click('button:has-text("New")');
  await page.click('a[href="/dashboard/new"]');

  // Wait for the new dashboard page to load
  await page.waitForSelector('[data-testid="data-testid Create new panel button"]', { timeout: 30000 });
  await page.click('[data-testid="data-testid Create new panel button"]');

  // Wait for the panel editor to load and handle potential datasource selector popup
  try {
    // Check if datasource selector popup appears (with shorter timeout)
    const testDataButton = page.locator('button:has(small:has-text("TestData"))');
    await testDataButton.waitFor({ state: 'visible', timeout: 5000 });
    await testDataButton.click();
  } catch (error) {
    // Datasource selector popup didn't appear, continue with test
  }

  // Select Canvas visualization
  await page.click('[data-testid="data-testid toggle-viz-picker"]');
  await page.click('[data-testid="Plugin visualization item Canvas"]');

  // Wait for canvas panel to load
  await page.waitForSelector('[data-testid="canvas-scene-pan-zoom"]', { timeout: 10000 });
}
