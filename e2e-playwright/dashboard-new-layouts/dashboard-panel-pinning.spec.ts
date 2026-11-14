import { expect, test } from './fixtures';

test.use({
  viewport: { width: 1920, height: 1080 },
  featureToggles: { dashboardNewLayouts: true },
  openFeature: { flags: { 'grafana.dashboardPanelPinning': true, 'grafana.panelActionsPopover': false } },
});

test(
  'keeps a pinned panel visible while the dashboard scrolls, resizes, and returns to its original layout',
  { tag: ['@dashboards'] },
  async ({ gotoDashboardPage, panels, canvas, page }) => {
    await gotoDashboardPage({ uid: 'edediimbjhdz4b/a-tall-dashboard' });
    const title = 'Panel #1';
    await expect(panels.getPanel(title)).toBeVisible();
    await panels.selectMenuItem(title, ['Pin to top']);

    const dock = page.getByRole('region', { name: 'Pinned panel' });
    await expect(panels.getPanel(title, dock)).toBeVisible();
    await expect(panels.getPanels(title)).toHaveCount(1);
    const top = (await dock.boundingBox())!.y;
    const scrollContainer = canvas.getContainer().locator('> div').first();
    await scrollContainer.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect.poll(() => scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(dock).toBeInViewport();
    await expect.poll(async () => (await dock.boundingBox())!.y).toBe(top);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dock).toBeInViewport();
    await expect.poll(async () => (await dock.boundingBox())!.height).toBeLessThanOrEqual(338);
    await panels.selectMenuItem(title, ['Unpin panel']);
    await scrollContainer.evaluate((element) => element.scrollTo(0, 0));
    await expect(panels.getPanel(title)).toBeVisible();
    await expect(panels.getPanels(title)).toHaveCount(1);
    await expect(dock).toBeHidden();
  }
);
