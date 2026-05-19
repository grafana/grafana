import { expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'UTv--wqMk';

// Tall viewport so all 12 panels render (dashboard uses 6 rows of 2 panels)
test.use({ viewport: { width: 1920, height: 2400 } });

test.describe('Panels test: Histogram', { tag: ['@panels', '@histogram'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors }) => {
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

  test.describe('panel options', { tag: ['@panel-options'] }, () => {
    test('legend', { tag: ['@legend'] }, async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: 'panel-4' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
      ).toBeVisible();

      const panelOptionsLegendGroup = page.getByTestId(selectors.components.OptionsGroup.group('Legend'));
      const legendVisibilityClickableLabel = panelOptionsLegendGroup.getByText('Visibility');
      const legendVisibilitySwitch = panelOptionsLegendGroup.getByLabel('Visibility');

      await expect(legendVisibilitySwitch, 'legend is enabled by default').toBeChecked();

      const legend = page.getByTestId(selectors.components.Panels.Visualization.Histogram.legend);
      await expect(legend, 'legend is rendered in histogram panel').toBeVisible();

      await legendVisibilityClickableLabel.click();
      await expect(legendVisibilitySwitch).not.toBeChecked();

      await expect(legend, 'legend is no longer visible').not.toBeVisible();
    });
  });

  test.describe('a11y', { tag: ['@a11y'] }, () => {
    test('run a11y report', async ({ gotoDashboardPage, scanForA11yViolations, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_UID,
        queryParams: new URLSearchParams({ viewPanel: 'panel-4' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Time series + Auto buckets'))
      ).toBeVisible();

      await expect(page.locator('.uplot')).toBeVisible();
      const report = await scanForA11yViolations({
        options: {
          runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
        },
      });

      expect(report).toHaveNoA11yViolations({
        ignoredRules: [
          'page-has-heading-one',
          'region',
          // @todo remove aria-command-name after https://github.com/grafana/grafana/issues/119651 is fixed
          'aria-command-name',
        ],
      });
    });
  });
});
