import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'UTv--wqMk';

// Tall viewport so all 12 panels render (dashboard uses 6 rows of 2 panels)
test.use({ viewport: { width: 1920, height: 2400 } });

test.describe('Panels test: Histogram', { tag: ['@panels', '@histogram'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
    ).toBeVisible();

    // Scroll to bottom so all panels render (DashboardPanel uses LazyLoader - panels load when in view)
    const lastPanelTitle = dashboardPage.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('heatmap-cells frame')
    );
    await lastPanelTitle.scrollIntoViewIfNeeded();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('displays panels with legends', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: 'panel-4' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
    ).toBeVisible();

    const legendVisibilityLabel = page.getByLabel(/Legend.+Visibility/);
    const legendVisibilitySwitch = legendVisibilityLabel.getByRole('switch');
    await expect(legendVisibilitySwitch).not.toBeChecked();

    const legend = page.getByTestId(selectors.components.Panels.Visualization.Histogram.legend);
    await expect(legend, 'legend is visible').toBeVisible();

    await legendVisibilityLabel.click();
    await expect(legendVisibilitySwitch).toBeChecked();

    await expect(legend, 'legend is visible').not.toBeVisible();
  });

  // test('a11y', { tag: ['@a11y'] }, async ({ scanForA11yViolations, selectors, page }) => {
  //   await page.goto(
  //     selectors.pages.SoloPanel.url(`${DASHBOARD_UID}/panel-tests-histogram?orgId=1&panelId=4`)
  //   );
  //   await expect(
  //     page.getByTestId(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
  //   ).toBeVisible({ timeout: 15000 });
  //   await expect(page.locator('.uplot')).toBeVisible({ timeout: 10000 });
  //   const report = await scanForA11yViolations({
  //     options: {
  //       runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
  //     },
  //   });
  //   expect(report).toHaveNoA11yViolations({ ignoredRules: ['page-has-heading-one', 'region', 'color-contrast'] });
  // });

  // test('panel edit opens and chart is visible', async ({ gotoDashboardPage, selectors, page }) => {
  //   const dashboardPage = await gotoDashboardPage({
  //     uid: DASHBOARD_UID,
  //     queryParams: new URLSearchParams({ editPanel: '4' }),
  //   });

  //   await expect(
  //     dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
  //   ).toBeVisible({ timeout: 15000 });

  //   const chart = page.locator('.uplot').first();
  //   await expect(chart, 'chart is visible in edit mode').toBeVisible({ timeout: 15000 });

  //   const optionsPaneContent = dashboardPage.getByGrafanaSelector(
  //     selectors.components.PanelEditor.OptionsPane.content
  //   );
  //   await expect(optionsPaneContent, 'options pane is visible').toBeVisible({ timeout: 10000 });
  // });
});
