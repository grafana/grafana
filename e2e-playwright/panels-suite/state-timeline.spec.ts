import { stat } from 'fs';

import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'Kce7z9TVz';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: StateTimeine', { tag: ['@panels', '@state-timeline'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    // check that gauges are rendered
    const stateTimelineUplot = page.locator('.uplot');
    await expect(stateTimelineUplot).toHaveCount(11);

    // check that no panel errors exist
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo).toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '15' }),
    });

    const stateTimelineUplot = page.locator('.uplot');
    await expect(stateTimelineUplot, "that uplot doesn't appear").toBeHidden();

    const emptyMessage = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage);
    await expect(emptyMessage, 'that the empty text appears').toHaveText('No data');

    // update the "No value" option and see if the panel updates
    const noValueOption = dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Standard options No value'))
      .locator('input');

    await noValueOption.fill('My empty value');
    await noValueOption.blur();
    await expect(emptyMessage, 'that the empty text has changed').toHaveText('My empty value');
  });

  test('tooltip interactions', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '13' }),
    });

    const stateTimelineUplot = page.locator('.uplot');
    await expect(stateTimelineUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover over a spot to trigger the tooltip
    await stateTimelineUplot.hover({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();
    await expect(tooltip, 'tooltip displays the value').toContainText('value5');
    await expect(tooltip, 'tooltip displays the duration').toContainText('Duration1h');

    // click to pin the tooltip, hover away to be sure it's pinned
    await stateTimelineUplot.click({ position: { x: 100, y: 50 } });
    await stateTimelineUplot.hover({ position: { x: 300, y: 50 } });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();
    await expect(tooltip, 'tooltip displays the first value').toContainText('value5');
    await expect(tooltip, 'tooltip displays the first duration').toContainText('Duration1h');

    // unpin the tooltip, ensure it closes on hover away
    await stateTimelineUplot.click({ position: { x: 300, y: 50 } });
    await stateTimelineUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning and hovering away').toBeHidden();

    // test clicking the "x" as well
    await stateTimelineUplot.click({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on "x" click').toBeHidden();

    // disable tooltips
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode'))
      .getByLabel('Hidden')
      .click();
    await stateTimelineUplot.hover({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip is not shown when disabled').toBeHidden();
  });
});
