import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '5Y0jv6pVz';
const TIME_RANGE_PAN_DASHBOARD_UID = 'YoacZIq7z';

test.describe('Panels test: Heatmap', { tag: ['@panels', '@heatmap'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    // check that gauges are rendered
    const uplot = page.locator('.uplot');
    await expect(uplot, 'panels are rendered').toHaveCount(2);

    // check that no panel errors exist
    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('"no data"', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '7' }),
    });

    const uplot = page.locator('.uplot');
    await expect(uplot, "that uplot doesn't appear").toBeHidden();

    const emptyMessage = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage);
    await expect(emptyMessage, 'that the empty text appears').toHaveText('No data');
  });

  // TODO tooltips, legends, and panel editing
});

test.use({
  featureToggles: {
    timeRangePan: true,
  },
});

test.describe('Panels test: Heatmap X-axis panning', { tag: ['@panels', '@heatmap'] }, () => {
  test('x-axis panning functionality', async ({ gotoDashboardPage, page, selectors }) => {
    let centerX: number;
    let centerY: number;
    let initialFromTime: number;
    let initialToTime: number;

    const dashboardPage = await test.step('Load dashboard and verify cursor changes to grab', async () => {
      const dashboardPage = await gotoDashboardPage({ uid: TIME_RANGE_PAN_DASHBOARD_UID });

      const heatmapPanel = page.locator('.uplot').first();
      await expect(heatmapPanel, 'panel rendered').toBeVisible();

      const xAxis = heatmapPanel.locator('.u-axis').first();
      await expect(xAxis, 'x-axis rendered').toBeVisible();

      await xAxis.hover();

      const cursorStyle = await xAxis.evaluate((el: HTMLElement) => window.getComputedStyle(el).cursor);
      expect(cursorStyle, 'cursor is grab').toBe('grab');

      return dashboardPage;
    });

    await test.step('Capture initial time range', async () => {
      const heatmapPanel = page.locator('.uplot').first();
      const xAxis = heatmapPanel.locator('.u-axis').first();

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
