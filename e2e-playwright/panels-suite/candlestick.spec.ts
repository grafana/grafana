import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'panel-tests-candlestick';
const PANNING_DASHBOARD_UID = 'MP-Di9F7k';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: Candlestick', { tag: ['@panels', '@candlestick'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const uplotElements = page.locator('.uplot');
    await expect(uplotElements, 'panels are rendered').toHaveCount(4);

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('tooltip interactions', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const candlestickUplot = page.locator('.uplot').first();
    await expect(candlestickUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    // hover to trigger tooltip — force bypasses any overlay elements
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();

    // click to pin, hover away to verify pinning
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await candlestickUplot.hover({ position: { x: 300, y: 100 }, force: true });
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    // unpin by clicking elsewhere
    await candlestickUplot.click({ position: { x: 300, y: 100 }, force: true });
    await candlestickUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning').toBeHidden();

    // close via X button
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on X click').toBeHidden();

    // CMD/CTRL+C does not dismiss
    await candlestickUplot.click({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await page.keyboard.press('Meta+C');
    await expect(tooltip, 'tooltip persists after CMD/CTRL+C').toBeVisible();

    // Escape key dismisses
    await page.keyboard.press('Escape');
    await expect(tooltip, 'tooltip closed on Escape').toBeHidden();

    // disable tooltips via options pane
    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode'))
      .getByLabel('Hidden')
      .click();
    await candlestickUplot.hover({ position: { x: 200, y: 100 }, force: true });
    await expect(tooltip, 'tooltip not shown when disabled').toBeHidden();
  });

  test('legend', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    const legend = dashboardPage.getByGrafanaSelector(selectors.components.VizLayout.legend);
    await expect(legend, 'legend is rendered').toBeVisible();

    const panelOptionsLegendGroup = page.getByTestId(selectors.components.OptionsGroup.group('Legend'));
    const legendVisibilityClickableLabel = panelOptionsLegendGroup.getByText('Visibility');
    const legendVisibilitySwitch = panelOptionsLegendGroup.getByLabel('Visibility');

    await expect(legendVisibilitySwitch, 'legend is enabled by default').toBeChecked();
    await legendVisibilityClickableLabel.click();
    await expect(legendVisibilitySwitch).not.toBeChecked();
    await expect(legend, 'legend is no longer visible').not.toBeVisible();
  });

  test('panel options in edit mode', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Mode'))
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Candle style')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Color strategy')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Up color')
      )
    ).toBeVisible();
    await expect(
      dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Candlestick Down color')
      )
    ).toBeVisible();
  });
});

test.use({
  featureToggles: {
    timeRangePan: true,
  },
});

test.describe('Panels test: Candlestick X-axis panning', { tag: ['@panels', '@candlestick'] }, () => {
  test('x-axis panning functionality', async ({ gotoDashboardPage, page, selectors }) => {
    let centerX: number;
    let centerY: number;
    let initialFromTime: number;
    let initialToTime: number;

    const dashboardPage = await test.step('Load dashboard and verify cursor changes to grab', async () => {
      const dashboardPage = await gotoDashboardPage({ uid: PANNING_DASHBOARD_UID });

      const candlestickPanel = page.locator('.uplot').first();
      await expect(candlestickPanel, 'panel rendered').toBeVisible();

      const xAxis = candlestickPanel.locator('.u-axis').first();
      await expect(xAxis, 'x-axis rendered').toBeVisible();

      await xAxis.hover();

      const cursorStyle = await xAxis.evaluate((el: HTMLElement) => window.getComputedStyle(el).cursor);
      expect(cursorStyle, 'cursor is grab').toBe('grab');

      return dashboardPage;
    });

    await test.step('Capture initial time range', async () => {
      const candlestickPanel = page.locator('.uplot').first();
      const xAxis = candlestickPanel.locator('.u-axis').first();

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
