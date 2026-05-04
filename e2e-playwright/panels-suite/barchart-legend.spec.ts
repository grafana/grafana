import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'ea33320b-bd97-4fe1-a27c-24bc61a48b41';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: BarChart legend', { tag: ['@panels', '@barchart'] }, () => {
  test('legend visibility toggle', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // verify legend is visible by default
    const legend = dashboardPage.getByGrafanaSelector(selectors.components.VizLayout.legend);
    await expect(legend, 'legend is rendered').toBeVisible();

    // find the visibility toggle in the Legend options group
    const panelOptionsLegendGroup = page.getByTestId(selectors.components.OptionsGroup.group('Legend'));
    const legendVisibilityClickableLabel = panelOptionsLegendGroup.getByText('Visibility');
    const legendVisibilitySwitch = panelOptionsLegendGroup.getByLabel('Visibility');

    // toggle visibility off and verify legend disappears
    await expect(legendVisibilitySwitch, 'legend is enabled by default').toBeChecked();
    await legendVisibilityClickableLabel.click();
    await expect(legendVisibilitySwitch).not.toBeChecked({ timeout: 400 });
    await expect(legend, 'legend is no longer visible').not.toBeVisible();
  });

  test('legend mode and placement toggles', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    // verify legend is visible before toggling options
    const legend = dashboardPage.getByGrafanaSelector(selectors.components.VizLayout.legend);
    await expect(legend, 'legend is rendered').toBeVisible();

    // switch mode from List to Table
    const modeOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Legend Mode')
    );
    await modeOption.getByLabel('Table').click();
    await expect(legend, 'legend still visible after mode switch').toBeVisible();

    // switch back to List
    await modeOption.getByLabel('List').click();
    await expect(legend, 'legend still visible after switching back').toBeVisible();

    // switch placement from Bottom to Right
    const placementOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Legend Placement')
    );
    await placementOption.getByLabel('Right').click();
    await expect(legend, 'legend still visible after placement switch').toBeVisible();

    // switch back to Bottom
    await placementOption.getByLabel('Bottom').click();
    await expect(legend, 'legend still visible after switching back').toBeVisible();
  });
});
