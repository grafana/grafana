import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'TkZXxlNG3';
const PANNING_DASHBOARD_UID = '1KxMUdE7k';

test.describe('Panels test: TimeSeries', { tag: ['@panels', '@timeseries'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const timeseriesUplot = page.locator('.uplot');
    await expect(timeseriesUplot.first(), 'panels are rendered').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('tooltip interactions', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '19' }),
    });

    const timeseriesUplot = page.locator('.uplot');
    await expect(timeseriesUplot, 'uplot is rendered').toBeVisible();

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);
    const hovered = { position: { x: 100, y: 50 } };
    const off = { position: { x: 300, y: 50 } };

    await timeseriesUplot.hover(hovered);
    await expect(tooltip, 'tooltip appears on hover').toBeVisible();

    await timeseriesUplot.click(hovered);
    await timeseriesUplot.hover(off);
    await expect(tooltip, 'tooltip pinned on click').toBeVisible();

    await timeseriesUplot.click(off);
    await timeseriesUplot.blur();
    await expect(tooltip, 'tooltip closed after unpinning and hovering away').toBeHidden();

    await timeseriesUplot.click(hovered);
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await dashboardPage.getByGrafanaSelector(selectors.components.Portal.container).getByLabel('Close').click();
    await expect(tooltip, 'tooltip closed on "x" click').toBeHidden();

    await timeseriesUplot.click(hovered);
    await expect(tooltip, 'tooltip appears on click').toBeVisible();
    await page.keyboard.press('Meta+C');
    await expect(tooltip, 'tooltip persists after CMD/CTRL+C').toBeVisible();

    await page.keyboard.press('Escape');
    await expect(tooltip, 'tooltip closed on Escape key').toBeHidden();

    await dashboardPage
      .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Tooltip Tooltip mode'))
      .getByLabel('Hidden')
      .click();
    await timeseriesUplot.hover(hovered);
    await expect(tooltip, 'tooltip is not shown when disabled').toBeHidden();
  });

  test('timeseries options are accessible in edit mode', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '47' }),
    });

    const fieldLabel = (label: string) =>
      dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(label));

    await expect(fieldLabel('Graph styles Style'), 'Style option is visible').toBeVisible();
    await expect(fieldLabel('Graph styles Line interpolation'), 'Line interpolation is visible').toBeVisible();
    await expect(fieldLabel('Graph styles Line width'), 'Line width is visible').toBeVisible();
    await expect(fieldLabel('Graph styles Fill opacity'), 'Fill opacity is visible').toBeVisible();
    await expect(fieldLabel('Graph styles Gradient mode'), 'Gradient mode is visible').toBeVisible();
    await expect(fieldLabel('Graph styles Show points'), 'Show points is visible').toBeVisible();
  });

  test('draw style change updates available options', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '47' }),
    });

    const fieldLabel = (label: string) =>
      dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(label));

    await expect(
      fieldLabel('Graph styles Line interpolation'),
      'Line interpolation visible for Line style'
    ).toBeVisible();

    await fieldLabel('Graph styles Style').getByLabel('Bars').click();

    await expect(
      fieldLabel('Graph styles Line interpolation'),
      'Line interpolation hidden for Bars style'
    ).toBeHidden();
    await expect(fieldLabel('Graph styles Bar alignment'), 'Bar alignment visible for Bars style').toBeVisible();
    await expect(fieldLabel('Graph styles Bar width factor'), 'Bar width factor visible for Bars style').toBeVisible();
  });

  test('legend toggle shows legend items', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '47' }),
    });

    const legendItem = dashboardPage.getByGrafanaSelector(selectors.components.VizLegend.seriesName('A-series'));
    await expect(legendItem, 'legend is initially hidden').toBeHidden();

    const legendVisibility = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('Legend Visibility')
    );
    await legendVisibility.getByText('Visibility').click();

    await expect(legendItem, 'A-series legend item is visible').toBeVisible();
  });
});

test.describe('Panels test: TimeSeries X-axis panning', { tag: ['@panels', '@timeseries'] }, () => {
  test('x-axis panning functionality', async ({ gotoDashboardPage, page, selectors }) => {
    let centerX: number;
    let centerY: number;
    let initialFromTime: number;
    let initialToTime: number;

    const dashboardPage = await test.step('Load dashboard and verify cursor changes to grab', async () => {
      const dashboardPage = await gotoDashboardPage({ uid: PANNING_DASHBOARD_UID });

      const timeseriesPanel = page.locator('.uplot').first();
      await expect(timeseriesPanel, 'panel rendered').toBeVisible();

      const xAxis = timeseriesPanel.locator('.u-axis').first();
      await expect(xAxis, 'x-axis rendered').toBeVisible();

      await xAxis.hover();

      const cursorStyle = await xAxis.evaluate((el: HTMLElement) => window.getComputedStyle(el).cursor);
      expect(cursorStyle, 'cursor is grab').toBe('grab');

      return dashboardPage;
    });

    await test.step('Capture initial time range', async () => {
      const timeseriesPanel = page.locator('.uplot').first();
      const xAxis = timeseriesPanel.locator('.u-axis').first();

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
