// import { BootData, PanelPluginMeta } from '@grafana/data';
// import { test, expect } from '@grafana/plugin-e2e';

// test.describe(
//   'Panels smokescreen',
//   {
//     // tag: ['@acceptance'],
//   },
//   () => {
//     test('Tests each panel type in the panel edit view to ensure no crash', async ({
//       gotoDashboardPage,
//       selectors,
//       page,
//     }) => {
//       // this test can absolutely take longer than the default 30s timeout
//       test.setTimeout(120000);

//       // Create new dashboard
//       const dashboardPage = await gotoDashboardPage({});

//       // Add new panel
//       await dashboardPage.addPanel();

//       // Get panel types from window object
//       const panelTypes: PanelPluginMeta[] = await page.evaluate(() => {
//         // @grafana/plugin-e2e doesn't export the full bootdata config
//         // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
//         const win = window as typeof window & { grafanaBootData: BootData };
//         return win.grafanaBootData?.settings?.panels ?? {};
//       });

//       const vizPicker = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker);
//       await expect(
//         vizPicker.filter({ hasText: 'Back' }),
//         'we should be viewing the viz picker already since this is a new panel'
//       ).toBeVisible();
//       await vizPicker.click({ force: true });

//       // Loop through every panel type and ensure no crash
//       for (const [_, panel] of Object.entries(panelTypes)) {
//         if (panel.hideFromList || panel.state === 'deprecated') {
//           continue; // Skip hidden and deprecated panels
//         }

//         try {
//           // Select the panel type in the viz picker
//           await expect(vizPicker.filter({ hasText: 'Change' }), 'we should be viewing panel options').toBeVisible();
//           await vizPicker.click({ force: true });
//           await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('All visualizations')).click();
//           await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item(panel.name)).click();

//           // Verify panel type is selected
//           await expect(
//             dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.header),
//             'verify panel editor for the selected panel type is rendered'
//           ).toHaveText(panel.name, { timeout: 10000 });

//           await expect(page.getByLabel('Panel loading bar'), 'wait for panel to finish rendering').toHaveCount(0, {
//             timeout: 10000,
//           });

//           await expect(
//             page.getByText('An unexpected error happened'),
//             'ensure no unexpected error occurred'
//           ).toBeHidden();
//         } catch (error) {
//           throw new Error(`Panel '${panel.name}' failed: ${error}`);
//         }
//       }
//     });
//   }
// );
