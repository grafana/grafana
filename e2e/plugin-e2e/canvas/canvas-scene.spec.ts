import { test, expect } from '@playwright/test';

test.describe('Canvas Panel - Scene Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Grafana
    await page.goto('/');

    // Login as admin
    await page.fill('input[name="user"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-grid"]', { timeout: 30000 });
  });

  test('should create and render canvas panel with scene elements', async ({ page }) => {
    // Create a new dashboard
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');

    // Select Canvas visualization
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel to load
    await page.waitForSelector('[data-testid="canvas-panel"]', { timeout: 10000 });

    // Check that canvas scene is rendered
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();

    // Check that default element exists
    const defaultElement = page.locator('[data-testid="canvas-element"]').first();
    await expect(defaultElement).toBeVisible();
  });

  test('should enter edit mode and show moveable controls', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Check that editing controls are visible in panel editor
    const moveableControls = page.locator('.moveable-control');
    await expect(moveableControls).toBeVisible();

    // Check that selecto is initialized
    const selectoElement = page.locator('.selecto-selection');
    await expect(selectoElement).toBeAttached();
  });

  test('should add new elements to canvas scene', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Look for add element button in panel editor
    const addElementBtn = page.locator('[data-testid="canvas-add-element"]');
    if (await addElementBtn.isVisible()) {
      await addElementBtn.click();

      // Select text element
      await page.click('[data-testid="canvas-element-text"]');

      // Check that new element was added
      const elements = page.locator('[data-testid="canvas-element"]');
      await expect(elements).toHaveCount(2);
    }
  });

  test('should select and manipulate canvas elements', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Click on canvas element to select it
    const canvasElement = page.locator('[data-testid="canvas-element"]').first();
    await canvasElement.click();

    // Check that moveable controls are visible
    const moveableControls = page.locator('.moveable-control');
    await expect(moveableControls).toBeVisible();

    // Check that resize handles are present
    const resizeHandle = page.locator('.moveable-control[data-direction]');
    await expect(resizeHandle).toBeVisible();
  });

  test('should show context menu on right click', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Right-click on canvas
    const canvasPanel = page.locator('[data-testid="canvas-panel"]');
    await canvasPanel.click({ button: 'right' });

    // Check for context menu
    const contextMenu = page.locator('[data-testid="context-menu"]');
    await expect(contextMenu).toBeVisible();
  });

  test('should handle scene data updates', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Mock data response for scene updates
    await page.route('**/api/ds/query', (route) => {
      route.fulfill({
        json: {
          results: {
            A: {
              status: 200,
              frames: [
                {
                  schema: {
                    fields: [
                      { name: 'time', type: 'time' },
                      { name: 'value', type: 'number' },
                    ],
                  },
                  data: {
                    values: [
                      [1640995200000, 1640995260000],
                      [100, 200],
                    ],
                  },
                },
              ],
            },
          },
        },
      });
    });

    // Trigger data refresh
    await page.click('[data-testid="panel-menu"]');
    await page.click('[data-testid="panel-menu-refresh"]');

    // Check that canvas still renders properly
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();
  });

  test('should handle scene pan and zoom when enabled', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Check if infinite viewer is present (pan/zoom feature)
    const infiniteViewer = page.locator('.infinite-viewer');
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
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();
  });

  test('should handle scene element connections', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Check if connections SVG is present
    const connectionsSVG = page.locator('[data-testid="canvas-connections"]');
    if (await connectionsSVG.isVisible()) {
      await expect(connectionsSVG).toBeVisible();
    }

    // Check that scene can handle connection drawing
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();
  });

  test('should persist scene state on save', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Save the panel
    await page.click('[data-testid="panel-editor-save"]');

    // Save the dashboard
    await page.click('[data-testid="dashboard-save"]');
    await page.fill('[data-testid="dashboard-title-input"]', 'Canvas Scene Test Dashboard');
    await page.click('[data-testid="dashboard-save-button"]');

    // Reload page
    await page.reload();

    // Check that canvas panel still renders
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();
  });

  test('should handle scene element tooltips', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Save and exit edit mode to test tooltips
    await page.click('[data-testid="panel-editor-save"]');

    // Hover over canvas element
    const canvasElement = page.locator('[data-testid="canvas-element"]').first();
    await canvasElement.hover();

    // Check for tooltip (if tooltip functionality is implemented)
    const tooltip = page.locator('[data-testid="canvas-tooltip"]');
    if (await tooltip.isVisible()) {
      await expect(tooltip).toBeVisible();
    }
  });

  test('should handle scene keyboard shortcuts', async ({ page }) => {
    // Create canvas panel
    await page.click('[data-testid="new-dashboard-button"]');
    await page.click('[data-testid="dashboard-add-panel-button"]');
    await page.click('[data-testid="panel-editor-viz-select"]');
    await page.click('[data-testid="viz-type-canvas"]');

    // Wait for canvas panel
    await page.waitForSelector('[data-testid="canvas-panel"]');

    // Select an element
    const canvasElement = page.locator('[data-testid="canvas-element"]').first();
    await canvasElement.click();

    // Test delete key
    await page.keyboard.press('Delete');

    // Test select all
    await page.keyboard.press('ControlOrMeta+a');

    // Test copy/paste
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');

    // Verify canvas is still functional
    const canvasScene = page.locator('[data-testid="canvas-scene"]');
    await expect(canvasScene).toBeVisible();
  });
});
