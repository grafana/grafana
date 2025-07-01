import { test, expect } from '@grafana/plugin-e2e';
import { GrafanaBootConfig } from '@grafana/runtime';

test.describe(
  'Panels smokescreen',
  {
    tag: ['@smoke'],
  },
  () => {
    test('Tests each panel type in the panel edit view to ensure no crash', async ({
      dashboardPage,
      selectors,
      page,
    }) => {
      // Create new dashboard
      await dashboardPage.goto();

      // Add new panel
      await dashboardPage.addPanel();

      // Get panel types from window object
      const panelTypes = await page.evaluate(() => {
        // TODO fix this type - probably update @grafana/plugin-e2e?
        const win = window as typeof window & { grafanaBootData: GrafanaBootConfig['bootData'] };
        return win.grafanaBootData?.settings?.panels ?? {};
      });

      // Loop through every panel type and ensure no crash
      for (const [_, panel] of Object.entries(panelTypes)) {
        // Skip hidden and deprecated panels
        if (!panel.hideFromList && panel.state !== 'deprecated') {
          // Open visualization picker
          const vizPicker = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);
          await vizPicker.click();
          await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item(panel.name)).click();

          // Verify panel type is selected
          await expect(vizPicker).toHaveText(panel.name);

          // Ensure no unexpected error occurred
          await expect(page.getByText('An unexpected error happened')).toBeHidden();
        }
      }
    });
  }
);
