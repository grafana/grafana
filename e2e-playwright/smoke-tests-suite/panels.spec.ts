import { BootData } from '@grafana/data';
import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Panels smokescreen',
  {
    tag: ['@acceptance'],
  },
  () => {
    test('Tests each panel type in the panel edit view to ensure no crash', async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      // this test can absolutely take longer than the default 30s timeout
      test.setTimeout(60000);

      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({});

      // Add new panel
      await dashboardPage.addPanel();

      // Get panel types from window object
      const panelTypes = await page.evaluate(() => {
        // @grafana/plugin-e2e doesn't export the full bootdata config

        const win = window as typeof window & { grafanaBootData: BootData };
        return win.grafanaBootData?.settings?.panels ?? {};
      });

      // Loop through every panel type and ensure no crash
      for (const [_, panel] of Object.entries(panelTypes)) {
        if (panel.hideFromList || panel.state === 'deprecated') {
          continue; // Skip hidden and deprecated panels
        }

        // Select the panel type in the viz picker
        const vizPicker = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);
        await vizPicker.click();
        await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item(panel.name)).click();

        // Verify panel type is selected
        await expect(vizPicker).toHaveText(panel.name);

        // Ensure no unexpected error occurred
        await expect(page.getByText('An unexpected error happened')).toBeHidden();
      }
    });
  }
);
