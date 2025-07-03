import { Page, Locator } from '@playwright/test';

export interface CanvasTestContext {
  page: Page;
  canvasPanel: Locator;
  canvasScene: Locator;
}

/**
 * Creates a new dashboard with a Canvas panel
 */
export async function createCanvasPanel(page: Page): Promise<CanvasTestContext> {
  // Navigate to Grafana
  await page.goto('/');

  // Login as admin
  await page.fill('input[name="user"]', 'admin');
  await page.fill('input[name="password"]', 'admin');
  await page.click('button[type="submit"]');

  // Wait for dashboard to load
  await page.waitForSelector('[data-testid="dashboard-grid"]', { timeout: 30000 });

  // Create a new dashboard
  await page.click('[data-testid="new-dashboard-button"]');
  await page.click('[data-testid="dashboard-add-panel-button"]');

  // Select Canvas visualization
  await page.click('[data-testid="panel-editor-viz-select"]');
  await page.click('[data-testid="viz-type-canvas"]');

  // Wait for canvas panel to load
  await page.waitForSelector('[data-testid="canvas-panel"]', { timeout: 10000 });

  const canvasPanel = page.locator('[data-testid="canvas-panel"]');
  const canvasScene = page.locator('[data-testid="canvas-scene"]');

  return {
    page,
    canvasPanel,
    canvasScene,
  };
}

/**
 * Adds a new element to the canvas
 */
export async function addCanvasElement(
  page: Page,
  elementType: 'text' | 'image' | 'metric' | 'server' = 'text'
): Promise<void> {
  const addElementBtn = page.locator('[data-testid="canvas-add-element"]');
  if (await addElementBtn.isVisible()) {
    await addElementBtn.click();
    await page.click(`[data-testid="canvas-element-${elementType}"]`);
  }
}

/**
 * Selects a canvas element by index
 */
export async function selectCanvasElement(page: Page, index: number = 0): Promise<Locator> {
  const elements = page.locator('[data-testid="canvas-element"]');
  const element = elements.nth(index);
  await element.click();
  return element;
}

/**
 * Waits for moveable controls to be visible
 */
export async function waitForMoveableControls(page: Page): Promise<void> {
  const moveableControls = page.locator('.moveable-control');
  await moveableControls.waitFor({ state: 'visible' });
}

/**
 * Moves an element by dragging it
 */
export async function moveElement(page: Page, element: Locator, deltaX: number, deltaY: number): Promise<void> {
  const boundingBox = await element.boundingBox();
  if (boundingBox) {
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY);
    await page.mouse.up();
  }
}

/**
 * Resizes an element using a resize handle
 */
export async function resizeElement(
  page: Page,
  direction: 'se' | 'sw' | 'ne' | 'nw' = 'se',
  deltaX: number,
  deltaY: number
): Promise<void> {
  const resizeHandle = page.locator(`.moveable-control[data-direction="${direction}"]`);
  await resizeHandle.waitFor({ state: 'visible' });

  const boundingBox = await resizeHandle.boundingBox();
  if (boundingBox) {
    const startX = boundingBox.x + boundingBox.width / 2;
    const startY = boundingBox.y + boundingBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + deltaX, startY + deltaY);
    await page.mouse.up();
  }
}

/**
 * Opens the context menu by right-clicking
 */
export async function openContextMenu(page: Page, target?: Locator): Promise<void> {
  const clickTarget = target || page.locator('[data-testid="canvas-panel"]');
  await clickTarget.click({ button: 'right' });
}

/**
 * Performs zoom operation on the canvas
 */
export async function zoomCanvas(page: Page, deltaY: number): Promise<void> {
  const canvasPanel = page.locator('[data-testid="canvas-panel"]');
  await canvasPanel.hover();
  await page.mouse.wheel(0, deltaY);
}

/**
 * Performs pan operation on the canvas
 */
export async function panCanvas(page: Page, startX: number, startY: number, endX: number, endY: number): Promise<void> {
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY);
  await page.mouse.up();
}

/**
 * Saves the current panel
 */
export async function savePanel(page: Page): Promise<void> {
  await page.click('[data-testid="panel-editor-save"]');
}

/**
 * Saves the current dashboard
 */
export async function saveDashboard(page: Page, title: string = 'Test Dashboard'): Promise<void> {
  await page.click('[data-testid="dashboard-save"]');
  await page.fill('[data-testid="dashboard-title-input"]', title);
  await page.click('[data-testid="dashboard-save-button"]');
}

/**
 * Waits for the canvas to be ready and interactive
 */
export async function waitForCanvasReady(page: Page): Promise<void> {
  // Wait for canvas panel
  await page.waitForSelector('[data-testid="canvas-panel"]');

  // Wait for scene to render
  await page.waitForSelector('[data-testid="canvas-scene"]');

  // Wait for any loading indicators to disappear
  await page
    .waitForSelector('[data-testid="loading-indicator"]', {
      state: 'hidden',
      timeout: 5000,
    })
    .catch(() => {
      // Ignore if loading indicator doesn't exist
    });
}

/**
 * Checks if feature flag is enabled
 */
export async function isFeatureEnabled(page: Page, featureName: string): Promise<boolean> {
  try {
    const result = await page.evaluate((name) => {
      return (window as any).grafanaBootData?.settings?.featureToggles?.[name] || false;
    }, featureName);
    return result;
  } catch {
    return false;
  }
}

/**
 * Mocks data source responses for testing
 */
export async function mockDataSourceResponse(page: Page, responseData: any): Promise<void> {
  await page.route('**/api/ds/query', (route) => {
    route.fulfill({
      json: {
        results: {
          A: {
            status: 200,
            frames: [responseData],
          },
        },
      },
    });
  });
}

/**
 * Takes a screenshot of the canvas for debugging
 */
export async function screenshotCanvas(page: Page, filename: string): Promise<void> {
  const canvas = page.locator('[data-testid="canvas-panel"]');
  await canvas.screenshot({ path: `screenshots/${filename}.png` });
}

/**
 * Waits for animations to complete
 */
export async function waitForAnimations(page: Page): Promise<void> {
  await page.waitForTimeout(300); // Wait for common animation durations
}

/**
 * Gets the count of canvas elements
 */
export async function getElementCount(page: Page): Promise<number> {
  const elements = page.locator('[data-testid="canvas-element"]');
  return await elements.count();
}

/**
 * Checks if an element is selected
 */
export async function isElementSelected(element: Locator): Promise<boolean> {
  const classes = await element.getAttribute('class');
  return classes?.includes('selected') || false;
}

/**
 * Performs keyboard shortcuts
 */
export async function performKeyboardShortcut(
  page: Page,
  shortcut: 'delete' | 'selectAll' | 'copy' | 'paste' | 'undo' | 'redo'
): Promise<void> {
  const shortcuts = {
    delete: 'Delete',
    selectAll: 'ControlOrMeta+a',
    copy: 'ControlOrMeta+c',
    paste: 'ControlOrMeta+v',
    undo: 'ControlOrMeta+z',
    redo: 'ControlOrMeta+y',
  };

  await page.keyboard.press(shortcuts[shortcut]);
}

/**
 * Waits for a specific number of elements to be present
 */
export async function waitForElementCount(page: Page, count: number): Promise<void> {
  const elements = page.locator('[data-testid="canvas-element"]');
  await elements.count().then(async (currentCount) => {
    if (currentCount !== count) {
      await page.waitForFunction(
        (expectedCount) => {
          const els = document.querySelectorAll('[data-testid="canvas-element"]');
          return els.length === expectedCount;
        },
        count,
        { timeout: 5000 }
      );
    }
  });
}
