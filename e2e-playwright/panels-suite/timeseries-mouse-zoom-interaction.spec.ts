import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'TkZXxlNG3';

test.describe('Panels test: Timeseries zoom interaction', { tag: ['@panels', '@timeseries'] }, () => {
  test('shows zoom cursor during x-axis drag-to-zoom interaction', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const uplotOverlay = page.locator('.u-over').first();
    await expect(uplotOverlay, 'uplot overlay is visible').toBeVisible();

    const bbox = await uplotOverlay.boundingBox();
    expect(bbox, 'uplot overlay has dimensions').toBeDefined();

    await expect(uplotOverlay, 'no zoom cursor initially').not.toHaveClass(/zoom-drag/);

    await page.mouse.move(bbox!.x + 100, bbox!.y + 50);
    await page.mouse.down();

    await expect(uplotOverlay, 'zoom cursor appears on mousedown').toHaveClass(/zoom-drag/);

    await page.mouse.move(bbox!.x + 300, bbox!.y + 50);

    await expect(uplotOverlay, 'zoom cursor persists during drag').toHaveClass(/zoom-drag/);

    await page.mouse.up();

    await expect(uplotOverlay, 'zoom cursor removed after mouseup').not.toHaveClass(/zoom-drag/);
  });

  test('shows zoom cursor during y-axis drag-to-zoom interaction with Shift key', async ({
    gotoDashboardPage,
    page,
  }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const uplotOverlay = page.locator('.u-over').first();
    await expect(uplotOverlay, 'uplot overlay is visible').toBeVisible();

    const bbox = await uplotOverlay.boundingBox();
    expect(bbox, 'uplot overlay has dimensions').toBeDefined();

    await expect(uplotOverlay, 'no zoom cursor initially').not.toHaveClass(/zoom-drag/);

    await page.keyboard.down('Shift');
    await page.mouse.move(bbox!.x + 100, bbox!.y + 50);
    await page.mouse.down();

    await expect(uplotOverlay, 'zoom cursor appears on mousedown with Shift').toHaveClass(/zoom-drag/);

    await page.mouse.move(bbox!.x + 100, bbox!.y + 150);

    await expect(uplotOverlay, 'zoom cursor persists during drag with Shift').toHaveClass(/zoom-drag/);

    await page.mouse.up();
    await page.keyboard.up('Shift');

    await expect(uplotOverlay, 'zoom cursor removed after mouseup').not.toHaveClass(/zoom-drag/);
  });

  test('does not show zoom cursor when modifier keys are pressed', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const uplotOverlay = page.locator('.u-over').first();
    await expect(uplotOverlay, 'uplot overlay is visible').toBeVisible();

    const bbox = await uplotOverlay.boundingBox();

    await page.keyboard.down('Control');
    await page.mouse.move(bbox!.x + 100, bbox!.y + 50);
    await page.mouse.down();

    await expect(uplotOverlay, 'no zoom cursor with Ctrl key').not.toHaveClass(/zoom-drag/);

    await page.mouse.up();
    await page.keyboard.up('Control');

    await page.keyboard.down('Meta');
    await page.mouse.move(bbox!.x + 100, bbox!.y + 50);
    await page.mouse.down();

    await expect(uplotOverlay, 'no zoom cursor with Meta key').not.toHaveClass(/zoom-drag/);

    await page.mouse.up();
    await page.keyboard.up('Meta');
  });
});
