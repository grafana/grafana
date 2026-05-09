import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'faceted-labels-demo';
const FIRST_PANEL_TITLE = 'Multiple names + labels (both sections)';

test.use({
  featureToggles: { vizLegendFacetedFilter: true },
});

test.describe('TimeSeries faceted labels filter', { tag: ['@panels', '@timeseries'] }, () => {
  test('filter toggle appears and opens popover with label sections', async ({
    gotoDashboardPage,
    page,
    selectors,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(FIRST_PANEL_TITLE));
    await expect(panel).toBeVisible();

    const filterToggle = page.getByTestId('faceted-labels-filter-toggle').first();
    await expect(filterToggle).toBeVisible();

    await filterToggle.click();

    const popover = page.getByTestId('toggletip-content');
    await expect(popover.getByText('By name')).toBeVisible();
    await expect(popover.getByText('By labels')).toBeVisible();
    await expect(popover.getByText('cpu', { exact: true })).toBeVisible();
    await expect(popover.getByText('mem', { exact: true })).toBeVisible();
    await expect(popover.getByText('disk', { exact: true })).toBeVisible();
  });

  test('selecting a name filters legend series', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(FIRST_PANEL_TITLE));
    await expect(panel).toBeVisible();

    await page.getByTestId('faceted-labels-filter-toggle').first().click();
    const popover = page.getByTestId('toggletip-content');
    await popover.getByText('cpu', { exact: true }).click();

    await expect(popover.getByRole('button', { name: 'Clear all' })).toBeVisible();
  });

  test('clear all resets filter', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(FIRST_PANEL_TITLE));
    await expect(panel).toBeVisible();

    await page.getByTestId('faceted-labels-filter-toggle').first().click();
    const popover = page.getByTestId('toggletip-content');
    await popover.getByText('cpu', { exact: true }).click();

    const clearAll = popover.getByRole('button', { name: 'Clear all' });
    await expect(clearAll).toBeVisible();
    await clearAll.click();

    await expect(popover.getByText('Select all').first()).toBeVisible();
  });

  test('select all selects all values for a key', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(FIRST_PANEL_TITLE));
    await expect(panel).toBeVisible();

    await page.getByTestId('faceted-labels-filter-toggle').first().click();
    const popover = page.getByTestId('toggletip-content');

    await popover.getByText('Select all', { exact: true }).first().click();

    await expect(popover.getByText('Deselect all').first()).toBeVisible();
  });

  test('filter becomes dimmed when legend item is clicked', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: '1' }),
    });

    await page.getByTestId('faceted-labels-filter-toggle').first().click();
    const popover = page.getByTestId('toggletip-content');
    await popover.getByText('cpu', { exact: true }).click();
    await popover.getByRole('button', { name: 'Pin to sidebar' }).click();

    const filter = page.getByTestId('faceted-labels-filter').first();
    await expect(filter).toHaveCSS('opacity', '1');

    const legendLabel = page.locator('button[class*="LegendLabel"]').first();
    await legendLabel.click();

    await expect(filter).toHaveCSS('opacity', '0.5');
  });

  test('pin to sidebar docks the filter', async ({ gotoDashboardPage, page, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(FIRST_PANEL_TITLE));
    await expect(panel).toBeVisible();

    await page.getByTestId('faceted-labels-filter-toggle').first().click();
    const popover = page.getByTestId('toggletip-content');
    await popover.getByRole('button', { name: 'Pin to sidebar' }).click();

    const unpinButton = page.getByRole('button', { name: 'Unpin' });
    await expect(unpinButton).toBeVisible();
    await expect(page.getByText('By name').first()).toBeVisible();
  });
});
