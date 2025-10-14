import { test, expect } from '@grafana/plugin-e2e';

const PANEL_UNDER_TEST = 'Lines 500 data points';

test.describe(
  'Panels test: Panel edit base',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests various Panel edit scenarios', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({ uid: 'TkZXxlNG3' });

      const panelTitle = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(PANEL_UNDER_TEST));
      await expect(panelTitle).toBeVisible();

      // Check that the panel is visible
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.loadingBar(''))).toHaveCount(0);
      await expect(panelTitle.locator('[data-testid="uplot-main-div"]').first()).toBeVisible();

      // Open panel menu and click edit
      await panelTitle.hover();
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(PANEL_UNDER_TEST)).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Edit')).click();

      // New panel editor opens when navigating from Panel menu
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

      // Queries tab is rendered and open by default
      const dataPane = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.DataPane.content);
      await expect(dataPane).toBeVisible();

      // Check that Queries tab is visible and active
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Queries'))).toBeVisible();
      await expect(page.locator(selectors.components.Tab.active(''))).toContainText('Queries1'); // there's already a query so therefore Query + 1

      // Check query content is visible and other tabs are not
      await expect(page.locator(`[data-testid="${selectors.components.QueryTab.content}"]`)).toBeVisible();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.AlertTab.content)).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelAlertTabContent.content)).toBeHidden();

      // Can change to Transform tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Transformations')).click();
      await expect(page.locator(selectors.components.Tab.active(''))).toContainText('Transformations0'); // no transforms so Transform + 0
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Transforms.addTransformationButton)
      ).toBeVisible();
      await expect(page.locator(`[data-testid="${selectors.components.QueryTab.content}"]`)).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.AlertTab.content)).toBeHidden();
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelAlertTabContent.content)).toBeHidden();

      // Can change to Alerts tab (graph panel is the default vis so the alerts tab should be rendered)
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Alert')).click();
      await expect(page.locator(selectors.components.Tab.active(''))).toContainText('Alert0'); // no alert so Alert + 0
      await expect(page.locator(`[data-testid="${selectors.components.QueryTab.content}"]`)).toBeHidden();

      // Go back to Queries tab
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Queries')).click();

      // Check that Time series is chosen
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker)).toContainText(
        'Time series'
      );

      // Check that table view works
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.loadingBar(''))).toHaveCount(0);
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });
      const tableHeader = page.getByRole('grid').getByRole('row').first();
      await expect(tableHeader).toBeVisible();
      await expect(tableHeader.getByText('A-series')).toBeVisible();

      // Change to Text panel
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item('Text')).click();
      // Check current visualization shows Text
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker)).toContainText(
        'Text'
      );

      // Data pane should not be rendered
      await expect(dataPane).toBeHidden();

      // Change to Table panel
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.PluginVisualization.item('Table')).click();
      // Check current visualization shows Table
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleVizPicker)).toContainText(
        'Table'
      );

      // Data pane should be rendered
      await expect(dataPane).toBeVisible();

      // Field & Overrides tabs (need to switch to React based vis, i.e. Table)
      await dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.toggleTableView).click({ force: true });

      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Table Show table header')
        )
      ).toBeVisible();
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel('Table Column width')
        )
      ).toBeVisible();
    });
  }
);
