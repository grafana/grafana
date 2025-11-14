import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'a2f4ad9e-3b44-4624-8067-35f31be5d309';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: StatusHistory', { tag: ['@panels', '@status-history'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    // check that gauges are rendered
    const statusHistoryUplot = page.locator('.uplot');
    await expect(statusHistoryUplot, 'panels are rendered').toHaveCount(11);

    // check that no panel errors exist
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '15' }),
    });

    const statusHistoryUplot = page.locator('.uplot');
    await expect(statusHistoryUplot, "that uplot doesn't appear").toBeHidden();

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

    const statusHistoryUplot = page.locator('.uplot');
    await expect(statusHistoryUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover over a spot to trigger the tooltip
    await statusHistoryUplot.hover({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();
    await expect(tooltip, 'tooltip displays the value').toContainText('value5');

    // click to pin the tooltip, hover away to be sure it's pinned
    await statusHistoryUplot.click({ position: { x: 100, y: 50 } });
    await statusHistoryUplot.hover({ position: { x: 300, y: 50 } });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();
    await expect(tooltip, 'tooltip displays the first value').toContainText('value5');

    // unpin the tooltip, ensure it closes on hover away
    await statusHistoryUplot.click({ position: { x: 300, y: 50 } });
    await statusHistoryUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning and hovering away').toBeHidden();

    // test clicking the "x" as well
    await statusHistoryUplot.click({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on "x" click').toBeHidden();

    // disable tooltips
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode'))
      .getByLabel('Hidden')
      .click();
    await statusHistoryUplot.hover({ position: { x: 100, y: 50 } });
    await expect(tooltip, 'tooltip is not shown when disabled').toBeHidden();
  });
});

test.use({
  featureToggles: {
    timeRangePan: true,
  },
});

test.describe('Panels test: Status History X-axis panning', { tag: ['@panels', '@status-history'] }, () => {
  test('x-axis panning functionality', async ({ gotoDashboardPage, page, selectors }) => {
    let centerX: number;
    let centerY: number;
    let initialFromTime: number;
    let initialToTime: number;

    const dashboardPage = await test.step('Load dashboard and verify cursor changes to grab', async () => {
      const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

      const statusHistoryPanel = page.locator('.uplot').first();
      await expect(statusHistoryPanel, 'panel rendered').toBeVisible();

      const xAxis = statusHistoryPanel.locator('.u-axis').first();
      await expect(xAxis, 'x-axis rendered').toBeVisible();

      await xAxis.hover();

      const cursorStyle = await xAxis.evaluate((el: HTMLElement) => window.getComputedStyle(el).cursor);
      expect(cursorStyle, 'cursor is grab').toBe('grab');

      return dashboardPage;
    });

    await test.step('Capture initial time range', async () => {
      const statusHistoryPanel = page.locator('.uplot').first();
      const xAxis = statusHistoryPanel.locator('.u-axis').first();

      const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
      const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

      const initialFrom = await fromField.inputValue();
      const initialTo = await toField.inputValue();
      initialFromTime = new Date(initialFrom).getTime();
      initialToTime = new Date(initialTo).getTime();

      await page.keyboard.press('Escape');

      const axisBox = await xAxis.boundingBox();
      if (!axisBox) {
        throw new Error('X-axis bounding box not found');
      }

      centerX = axisBox.x + axisBox.width / 2;
      centerY = axisBox.y + axisBox.height / 2;
    });

    await test.step('Drag right pans backward in time', async () => {
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX + 100, centerY);
      await page.mouse.up();

      await page.waitForTimeout(1000);

      const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
      const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

      const afterRightFrom = await fromField.inputValue();
      const afterRightTo = await toField.inputValue();
      const afterRightFromTime = new Date(afterRightFrom).getTime();
      const afterRightToTime = new Date(afterRightTo).getTime();

      expect(afterRightFromTime, 'panned backward').toBeLessThan(initialFromTime);
      expect(afterRightToTime, 'panned backward').toBeLessThan(initialToTime);

      await page.keyboard.press('Escape');

      initialFromTime = afterRightFromTime;
      initialToTime = afterRightToTime;
    });

    await test.step('Drag left pans forward in time', async () => {
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX - 100, centerY);
      await page.mouse.up();

      await page.waitForTimeout(1000);

      const timePickerButton = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.openButton);
      await timePickerButton.click();

      const fromField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.fromField);
      const toField = dashboardPage.getByGrafanaSelector(selectors.components.TimePicker.toField);

      const afterLeftFrom = await fromField.inputValue();
      const afterLeftTo = await toField.inputValue();
      const afterLeftFromTime = new Date(afterLeftFrom).getTime();
      const afterLeftToTime = new Date(afterLeftTo).getTime();

      expect(afterLeftFromTime, 'panned forward').toBeGreaterThan(initialFromTime);
      expect(afterLeftToTime, 'panned forward').toBeGreaterThan(initialToTime);
    });
  });
});
