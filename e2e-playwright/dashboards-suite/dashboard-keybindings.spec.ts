import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Dashboard keybindings',
  {
    tag: ['@dashboards'],
  },
  () => {
    // the "should collapse and expand all rows" test requires a larger viewport
    // otherwise the final panel is not visible when everything is expanded
    test.use({
      viewport: { width: 1280, height: 1080 },
    });

    test('should collapse and expand all rows', async ({ gotoDashboardPage, page, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'Repeating-rows-uid/repeating-rows' });

      const panelContents = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content);
      await expect(panelContents).toHaveCount(5);
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('server = A, pod = Bob'))
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('server = B, pod = Bob'))
      ).toBeVisible();

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

    test('should open panel inspect', async ({ gotoDashboardPage, page, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'edediimbjhdz4b/a-tall-dashboard' });

      // Find Panel #1 and press 'i' to open inspector
      const panel1 = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Panel #1'));
      await expect(panel1).toBeVisible();
      await panel1.press('i');

      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelInspector.Json.content)).toBeVisible();

      // Press Escape to close inspector
      await page.keyboard.press('Escape');

      await expect(page.getByTestId(selectors.components.PanelInspector.Json.content)).toBeHidden();
    });
  }
);
