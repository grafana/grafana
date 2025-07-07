import { test, expect, Page } from '@playwright/test';

test.describe('Canvas Panel - Scene Tests', () => {
  test.beforeEach(async ({ page }) => {
    await createCanvasPanel(page);
  });

  test('should create and render canvas panel with scene elements', async ({ page }) => {
    // Check that default element exists
    await page.waitForSelector('[data-testid="canvas-element"]', { timeout: 10000 });
    const defaultElement = page.locator('[data-testid="canvas-element"]');
    await expect(defaultElement).toBeVisible();
  });

  test('should handle scene pan and zoom when enabled', async ({ page }) => {
    // Check if canvas panel pan/zoom feature toggle is enabled
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
        // Test zoom functionality
        await page.mouse.wheel(0, -100);

        // Test pan functionality
        await page.mouse.move(100, 100);
        await page.mouse.down();
        await page.mouse.move(150, 150);
        await page.mouse.up();

        // Test zoom reset with double-click
        await infiniteViewer.dblclick();
      }

      // Verify canvas is still functional
      const canvasScene = page.locator('[data-testid="canvas-scene-pan-zoom"]');
      await expect(canvasScene).toBeVisible();
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
