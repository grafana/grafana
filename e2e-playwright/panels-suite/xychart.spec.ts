import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'fdn48fmz8f94wc';

test.use({
  viewport: { width: 1280, height: 2000 },
});

test.describe('Panels test: XYChart', { tag: ['@panels', '@xychart'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const panelTitle = page.getByRole('heading', { name: 'MPG vs Acceleration (by Country)', level: 2 });
    await expect(panelTitle, 'first panel is visible').toBeVisible();

    const lastPanelTitle = page.getByRole('heading', { name: 'XY with time', level: 2 });
    await expect(lastPanelTitle, 'last panel is visible').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test(
    'is accessible',
    { tag: ['@a11y', '@panel', '@xychart'] },
    async ({ gotoDashboardPage, scanForA11yViolations, page }) => {
      await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '8' }),
      });

      await expect(page.getByRole('button', { name: 'USA' }), 'USA legend item is visible').toBeVisible();

      const report = await scanForA11yViolations();
      expect(report).toHaveNoA11yViolations({
        ignoredRules: ['aria-prohibited-attr'],
      });
    }
  );

  test('"no data" shows panel error message', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '16' }),
    });

    const xyChartUplot = page.locator('.uplot');
    await expect(xyChartUplot, 'xychart uplot does not appear for empty data').toBeHidden();

    const emptyMessage = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage);
    await expect(emptyMessage, 'empty panel message is shown').toBeVisible();
  });

  test('legend items are visible', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    await expect(page.getByRole('button', { name: 'USA' }), 'USA legend item is visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Europe' }), 'Europe legend item is visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Japan' }), 'Japan legend item is visible').toBeVisible();
  });

  test('series mapping options are accessible in edit mode', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    const seriesMappingLabel = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('XY Chart Series mapping')
    );
    await expect(seriesMappingLabel, 'series mapping option is visible').toBeVisible();
    await expect(seriesMappingLabel.locator('text=Auto'), 'auto is selected by default').toBeVisible();
  });

  test('point options are accessible in edit mode', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '8' }),
    });

    const showLabel = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('XY Chart Show')
    );
    await expect(showLabel, 'show option is visible').toBeVisible();

    const pointSizeLabel = dashboardPage.getByGrafanaSelector(
      selectors.components.PanelEditor.OptionsPane.fieldLabel('XY Chart Point size')
    );
    await expect(pointSizeLabel, 'point size option is visible').toBeVisible();
  });

  test('tooltip interactions', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const panel1 = page.getByRole('region', { name: 'MPG vs Acceleration (by Country)' });
    await panel1.scrollIntoViewIfNeeded();
    await expect(panel1, 'panel 1 is visible').toBeVisible();

    const xyChartUplot = panel1.locator('.uplot').first();
    await xyChartUplot.waitFor({ state: 'visible', timeout: 5000 });

    const tooltip = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Tooltip.Wrapper);

    const box = await xyChartUplot.boundingBox();
    expect(box).not.toBeNull();

    const step = Math.max(50, box!.width / 10);
    for (let x = box!.x + 10; x < box!.x + box!.width; x += step) {
      for (let y = box!.y + 10; y < box!.y + box!.height; y += step) {
        await page.mouse.move(x, y);
        if (await tooltip.isVisible()) {
          await page.mouse.click(box!.x + box!.width + 200, box!.y + box!.height + 200);
          await expect(tooltip, 'tooltip hides after clicking away').toBeHidden({ timeout: 3000 });
          return;
        }
      }
    }

    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(tooltip, 'tooltip appears on click').toBeVisible({ timeout: 3000 });
  });
});
