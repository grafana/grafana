import { test, expect } from '@grafana/plugin-e2e';

import { getUPlotCenterPosition } from './barchart-utils';

const DASHBOARD_UID = 'panel-tests-barchart';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: BarChart options', { tag: ['@panels', '@barchart'] }, () => {
  test('show values - toggle always/never/auto', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '7' }),
    });

    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot renders with showValue=always').toBeVisible();

    const showValuesOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Bar chart Show values')
    );
    await showValuesOption.scrollIntoViewIfNeeded();

    // switch to Never — panel still renders
    await showValuesOption.getByLabel('Never').click();
    await expect(barchartUplot, 'uplot renders after switching to Never').toBeVisible();

    // switch to Auto — panel still renders
    await showValuesOption.getByLabel('Auto').click();
    await expect(barchartUplot, 'uplot renders after switching to Auto').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after toggling show values').toBeHidden();
  });

  test('stacking 100 percent - renders and shows tooltip', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot renders with stacking=percent').toBeVisible();

    // stacking toggle: Normal → Off → back to 100%
    const stackingOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Bar chart Stacking')
    );
    await stackingOption.scrollIntoViewIfNeeded();

    await stackingOption.getByLabel('Normal').click();
    await expect(barchartUplot, 'uplot renders with Normal stacking').toBeVisible();

    await stackingOption.scrollIntoViewIfNeeded();
    await stackingOption.getByLabel('Off').click();
    await expect(barchartUplot, 'uplot renders with None stacking').toBeVisible();

    await stackingOption.scrollIntoViewIfNeeded();
    await stackingOption.getByLabel('100%').click();
    await expect(barchartUplot, 'uplot renders with 100% stacking').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after toggling stacking').toBeHidden();

    // tooltip works in 100% stacking mode — do this last so Escape doesn't exit editor
    const center = await getUPlotCenterPosition(barchartUplot);
    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);
    await barchartUplot.hover({ position: center, force: true });
    await expect(tooltip, 'tooltip appears on hover with stacking 100%').toBeVisible();
  });

  test('full highlight - tooltip appears across bar column', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '9' }),
    });

    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot renders with fullHighlight=true').toBeVisible();

    // full highlight toggle visible in pane (only shown when stacking=none)
    const fullHighlightField = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Bar chart Highlight full area on hover')
    );
    await fullHighlightField.scrollIntoViewIfNeeded();
    const fullHighlightSwitch = fullHighlightField.getByRole('switch');
    await expect(fullHighlightSwitch, 'full highlight toggle is visible').toBeVisible();
    await expect(fullHighlightSwitch, 'full highlight is enabled').toBeChecked();

    // tooltip works with full highlight — do this last so Escape doesn't exit editor
    const center = await getUPlotCenterPosition(barchartUplot);
    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);
    await barchartUplot.hover({ position: center, force: true });
    await expect(tooltip, 'tooltip appears on hover with full highlight enabled').toBeVisible();
  });

  test('orientation - toggle vertical and horizontal', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot renders in auto orientation').toBeVisible();

    const orientationOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Bar chart Orientation')
    );

    await orientationOption.getByLabel('Horizontal').click();
    await expect(barchartUplot, 'uplot renders in horizontal orientation').toBeVisible();

    await orientationOption.getByLabel('Vertical').click();
    await expect(barchartUplot, 'uplot renders in vertical orientation').toBeVisible();

    await orientationOption.getByLabel('Auto').click();
    await expect(barchartUplot, 'uplot renders back in auto orientation').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors after toggling orientation').toBeHidden();
  });
});
