import { test, expect } from '@grafana/plugin-e2e';

import { Panels } from './page-objects';

test.use({
  featureToggles: {
    dashboardNewLayouts: true,
  },
});

test.describe('Dashboard keybindings with new layouts', { tag: ['@dashboards'] }, () => {
  test.use({
    viewport: { width: 1280, height: 1080 },
  });

  test('should collapse and expand all rows', async ({ gotoDashboardPage, page, selectors, components }) => {
    const dashboardPage = await gotoDashboardPage({ uid: 'Repeating-rows-uid/repeating-rows' });
    const panels = new Panels({ page, dashboardPage, selectors, components });

    const panelContents = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
    await expect(panelContents).toHaveCount(5);
    await expect(panels.getContainer('server = A, pod = Bob')).toBeVisible();
    await expect(panels.getContainer('server = B, pod = Bob')).toBeVisible();

    // Collapse all rows using keyboard shortcut: d + Shift+C
    await page.keyboard.press('d');
    await page.keyboard.press('Shift+C');

    await expect(panelContents).toHaveCount(0);
    await expect(page.getByText('server = A, pod = Bob')).toBeHidden();
    await expect(page.getByText('server = B, pod = Bob')).toBeHidden();

    // Expand all rows using keyboard shortcut: d + Shift+E
    await page.keyboard.press('d');
    await page.keyboard.press('Shift+E');

    await expect(panelContents).toHaveCount(6);
    await expect(page.getByText('server = A, pod = Bob')).toBeVisible();
    await expect(page.getByText('server = B, pod = Bob')).toBeVisible();
  });

  test('should open panel inspect', async ({ gotoDashboardPage, page, selectors, components }) => {
    const dashboardPage = await gotoDashboardPage({ uid: 'edediimbjhdz4b/a-tall-dashboard' });
    const panels = new Panels({ page, dashboardPage, selectors, components });

    const panel1 = panels.getContainer('Panel #1');
    await expect(panel1).toBeVisible();
    await panel1.press('i');

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeVisible();

    // Press Escape to close tooltip on the close button
    await page.keyboard.press('Escape');
    // Press Escape to close inspector
    await page.keyboard.press('Escape');

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeHidden();
  });
});
