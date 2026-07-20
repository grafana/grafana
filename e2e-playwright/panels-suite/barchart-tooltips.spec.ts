import { test, expect } from '@grafana/plugin-e2e';

import { getUPlotCenterPosition } from './barchart-utils';

const DASHBOARD_UID = 'ea33320b-bd97-4fe1-a27c-24bc61a48b41';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: BarChart tooltips', { tag: ['@panels', '@barchart'] }, () => {
  test('tooltip interactions', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const barchartUplot = page.locator('.uplot').first();
    await expect(barchartUplot, 'uplot is rendered').toBeVisible();

    const center = await getUPlotCenterPosition(barchartUplot);
    const hoverable = { x: center.x, y: center.y - 150 }; // hover slightly off-center to avoid hitting the pin button
    const alt = { x: Math.round(center.x / 2), y: Math.round(center.y / 2) };

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover to trigger tooltip — force bypasses any overlay elements
    await barchartUplot.hover({ position: hoverable, force: true });
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();

    // click to pin, hover away to verify pinning
    await barchartUplot.click({ position: hoverable, force: true });
    await barchartUplot.hover({ position: alt, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    // unpin by clicking elsewhere
    await barchartUplot.click({ position: alt, force: true });
    await barchartUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning').toBeHidden();

    // close via X button
    await barchartUplot.click({ position: hoverable, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on X click').toBeHidden();

    // CMD/CTRL+C does not dismiss
    await barchartUplot.click({ position: hoverable, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await page.keyboard.press('ControlOrMeta+C');
    await expect(tooltip, 'tooltip persists after CMD/CTRL+C').toBeVisible();

    // Escape key dismisses
    await page.keyboard.press('Escape');
    await expect(tooltip, 'tooltip closed on Escape').toBeHidden();

    // switch to All mode — tooltip should still appear
    const tooltipModeOption = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode')
    );
    await tooltipModeOption.getByLabel('All').click();
    await barchartUplot.hover({ position: hoverable, force: true });
    await expect(tooltip, 'tooltip appears in All mode').toBeVisible();

    // dismiss tooltip before switching mode
    await page.keyboard.press('Escape');

    // switch to Hidden — tooltip should not appear
    await tooltipModeOption.getByLabel('Hidden').click();
    await barchartUplot.hover({ position: hoverable, force: true });
    await expect(tooltip, 'tooltip not shown when disabled').toBeHidden();
  });
});
