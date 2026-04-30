import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = '5Y0jv6pVz';
const TIME_RANGE_PAN_DASHBOARD_UID = 'YoacZIq7z';

test.describe('Panels test: Heatmap', { tag: ['@panels', '@heatmap'] }, () => {
  test.use({
    viewport: { width: 1280, height: 2200 },
  });

  test('renders dashboard with row and cells heatmaps', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await test.step('Row layout and cells heatmap panels are present', async () => {
      await expect(page.getByText('Row heatmap (data links)')).toBeVisible();
      await expect(page.getByText('Cells heatmap')).toBeVisible();
    });

    await test.step('Two uPlot heatmaps render without panel errors', async () => {
      const uplot = page.locator('.uplot');
      await expect(uplot, 'row + cells heatmaps').toHaveCount(2);
      const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
      await expect(errorInfo, 'no errors in the panels').toBeHidden();
    });
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

  test('tooltip: hover, pin, dismiss with Escape; Hidden mode hides tooltip', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    const heatmapUplot = page.locator('.uplot').first();
    await expect(heatmapUplot, 'uplot is rendered').toBeVisible();

    const uOver = heatmapUplot.locator('.u-over');
    const box = await uOver.boundingBox();
    if (!box) {
      throw new Error('u-over bounding box not found');
    }
    const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };
    const alt = { x: Math.round(box.width / 4), y: center.y };

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    await test.step('Hover shows tooltip', async () => {
      await heatmapUplot.hover({ position: center, force: true });
      await expect(tooltip, 'tooltip appears on hover').toBeVisible();
    });

    await test.step('Click pins tooltip; hover elsewhere keeps it pinned', async () => {
      await heatmapUplot.click({ position: center, force: true });
      await heatmapUplot.hover({ position: alt, force: true });
      await expect(tooltip, 'tooltip pinned on click').toBeVisible();
    });

    await test.step('Escape dismisses pinned tooltip', async () => {
      await page.keyboard.press('Escape');
      await expect(tooltip, 'tooltip closed on Escape').toBeHidden();
    });

    await test.step('Tooltip mode Hidden suppresses tooltip on hover', async () => {
      const tooltipModeOption = page.getByTestId('data-testid Tooltip Tooltip mode field property editor');
      await tooltipModeOption.scrollIntoViewIfNeeded();
      await tooltipModeOption.getByRole('radio', { name: /hidden/i }).click();
      await heatmapUplot.hover({ position: center, force: true });
      await expect(tooltip, 'tooltip not shown when disabled').toBeHidden();
    });
  });

  test('data links in pinned tooltip; field actions are not offered (heatmap)', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    const heatmapUplot = page.locator('.uplot').first();
    await expect(heatmapUplot, 'uplot is rendered').toBeVisible();

    const uOver = heatmapUplot.locator('.u-over');
    const box = await uOver.boundingBox();
    if (!box) {
      throw new Error('u-over bounding box not found');
    }
    const center = { x: Math.round(box.width / 2), y: Math.round(box.height / 2) };

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    await heatmapUplot.hover({ position: center, force: true });
    await expect(tooltip, 'tooltip shown on hover').toBeVisible();
    await heatmapUplot.click({ position: center, force: true });
    await expect(
      page.getByTestId(selectors.components.Portal.container).getByRole('button', { name: 'Close' }),
      'tooltip pinned on click'
    ).toBeVisible();

    await expect(tooltip.getByText('Heatmap docs data link'), 'data link visible in tooltip').toBeVisible();

    await expect(
      tooltip.getByRole('button', { name: 'Heatmap unsupported action' }),
      'field actions are not supported for heatmap (see docs)'
    ).toHaveCount(0);
  });

  test('legend: toggling Show legend hides and shows color scale', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    const legend = page.getByTestId('data-testid viz-layout-legend');
    await expect(legend, 'legend is rendered').toBeVisible();

    const panelOptionsLegendGroup = page.getByTestId('data-testid Options group Legend');
    await panelOptionsLegendGroup.scrollIntoViewIfNeeded();
    const legendSwitch = panelOptionsLegendGroup.getByLabel('Show legend');
    const legendLabel = panelOptionsLegendGroup.getByText('Show legend', { exact: true });

    await test.step('Turn legend off', async () => {
      await expect(legendSwitch, 'legend is enabled by default').toBeChecked();
      await legendLabel.click();
      await expect(legendSwitch).not.toBeChecked({ timeout: 400 });
      await expect(legend, 'legend is no longer visible').not.toBeVisible();
    });

    await test.step('Turn legend back on', async () => {
      await legendLabel.click();
      await expect(legendSwitch).toBeChecked({ timeout: 400 });
      await expect(legend, 'legend visible again').toBeVisible();
    });
  });

  test('panel options: Y axis reverse and tooltip histogram toggle', async ({ gotoDashboardPage, page }) => {
    test.slow();
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '4' }),
    });

    // Histogram first: toggling Y reverse re-renders the chart and can destabilize the options pane
    // while the next control is still settling (30s timeout + closed page flake).
    const histogramField = page.getByTestId('data-testid Tooltip Show histogram (Y axis) field property editor');
    await histogramField.scrollIntoViewIfNeeded();
    const histogramInput = histogramField.locator('input[type="checkbox"]');
    const histogramLabel = histogramField.getByText('Show histogram (Y axis)', { exact: true });
    await expect(histogramInput, 'histogram starts off').not.toBeChecked();
    await histogramLabel.click();
    await expect(histogramInput, 'histogram toggled on').toBeChecked();

    const reverseField = page.getByTestId('data-testid Y Axis Reverse field property editor');
    await reverseField.scrollIntoViewIfNeeded();
    const reverseInput = reverseField.locator('input[type="checkbox"]');
    const reverseLabel = reverseField.getByText('Reverse', { exact: true });
    await expect(reverseInput, 'reverse starts off').not.toBeChecked();
    await reverseLabel.click();
    await expect(reverseInput, 'reverse toggled on').toBeChecked();
  });
});

test.use({
  featureToggles: {
    dashboardNewLayouts: false,
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
