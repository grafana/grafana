import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'b36b5576-2e3d-4b0c-8dce-e79514d99345';

test.describe('Panels test: Trend', { tag: ['@panels', '@trend'] }, () => {
  test('renders successfully', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
    });

    const panelTitle = page.getByRole('heading', { name: 'Engine Power and Torque Curves', level: 2 });
    await expect(panelTitle, 'panel title is visible').toBeVisible();

    const trendUplot = page.locator('.uplot');
    await expect(trendUplot, 'trend panel is rendered').toBeVisible();

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in the panels').toBeHidden();
  });

  test('legend', { tag: ['@legend'] }, async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(page.locator('.uplot'), 'trend panel is rendered').toBeVisible();

    const panelOptionsLegendGroup = page.getByTestId(selectors.components.OptionsGroup.group('Legend'));
    const legendVisibilityClickableLabel = panelOptionsLegendGroup.getByText('Visibility');
    const legendVisibilitySwitch = panelOptionsLegendGroup.getByLabel('Visibility');

    await expect(legendVisibilitySwitch, 'legend is enabled by default').toBeChecked();

    await expect(page.getByRole('button', { name: 'Torque (NM)' }), 'legend item is visible').toBeVisible();

    await legendVisibilityClickableLabel.click();
    await expect(legendVisibilitySwitch).not.toBeChecked();

    await expect(
      page.getByRole('button', { name: 'Torque (NM)' }),
      'legend item is no longer visible'
    ).not.toBeVisible();
  });

  test('no data', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '2' }),
    });

    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage),
      'empty panel message is shown'
    ).toBeVisible();
  });

  test('a11y', { tag: ['@a11y'] }, async ({ gotoDashboardPage, scanForA11yViolations, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await expect(page.locator('.uplot'), 'trend panel is rendered').toBeVisible();

    const report = await scanForA11yViolations({
      options: {
        runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
      },
    });

    expect(report).toHaveNoA11yViolations({
      ignoredRules: ['page-has-heading-one', 'region', 'aria-command-name', 'heading-order', 'landmark-unique'],
    });
  });
});
