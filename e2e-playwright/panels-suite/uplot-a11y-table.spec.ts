import { expect, test } from '@grafana/plugin-e2e';

// Panels that render KeyboardPlugin (timeseries, trend, candlestick) expose a screen-reader-only
// table of their source DataFrames (UPlotA11y), linked to the focusable chart root via aria-details.
// These tests reuse provisioned gdev dashboards.

// The sr-only container rendered by UPlotA11y.
const A11Y_TABLE = '[data-testid="uplot-a11y"]';

// Pagination thresholds mirror the constants in UPlotA11y (FRAMES_PER_PAGE, ROWS_PER_PAGE).
const FRAMES_PER_PAGE = 5;
const ROWS_PER_PAGE = 25;

interface PanelUnderTest {
  type: string;
  uid: string;
  viewPanel: string;
  title: string;
}

// One representative panel per KeyboardPlugin-enabled visualization.
const KEYBOARD_PANELS: PanelUnderTest[] = [
  { type: 'timeseries', uid: 'TkZXxlNG3', viewPanel: 'panel-19', title: 'Single mode' },
  {
    type: 'trend',
    uid: 'b36b5576-2e3d-4b0c-8dce-e79514d99345',
    viewPanel: 'panel-1',
    title: 'Engine Power and Torque Curves',
  },
  { type: 'candlestick', uid: 'panel-tests-candlestick', viewPanel: 'panel-1', title: 'Candles and Volume' },
];

// Panels NOT using KeyboardPlugin should not render the table.
const NON_KEYBOARD_PANELS: PanelUnderTest[] = [
  { type: 'barchart', uid: 'WFlOM-jM1', viewPanel: 'panel-22', title: 'Single Series' },
  { type: 'heatmap', uid: '5Y0jv6pVz', viewPanel: 'panel-6', title: 'Cells heatmap' },
];

const TIMESERIES_UID = 'TkZXxlNG3';

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('Panels test: uPlot accessibility table', { tag: ['@panels', '@a11y'] }, () => {
  for (const panel of KEYBOARD_PANELS) {
    test(`renders an sr-only data table for the ${panel.type} panel`, async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: panel.uid,
        queryParams: new URLSearchParams({ viewPanel: panel.viewPanel }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panel.title))
      ).toBeVisible();
      await expect(page.locator('.uplot')).toBeVisible();

      const a11yTable = page.locator(A11Y_TABLE);
      await expect(a11yTable).toBeAttached();

      // a real table rendered from the frames (not the "no data" fallback)
      await expect(a11yTable.locator('table').first()).toBeAttached();
      await expect(a11yTable.locator('th').first()).toBeAttached();
      await expect(a11yTable.locator('tbody tr').first()).toBeAttached();

      // the focusable chart root is a figure whose details point at the table
      const tableId = await a11yTable.getAttribute('id');
      expect(tableId).toBeTruthy();
      const chartRoot = page.locator('.uplot');
      await expect(chartRoot).toHaveAttribute('role', 'figure');
      await expect(chartRoot).toHaveAttribute('aria-details', tableId!);
    });
  }

  for (const panel of NON_KEYBOARD_PANELS) {
    test(`does not render the sr-only table for the ${panel.type} panel`, async ({
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: panel.uid,
        queryParams: new URLSearchParams({ viewPanel: panel.viewPanel }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panel.title))
      ).toBeVisible();
      await expect(page.locator('.uplot')).toBeVisible();

      await expect(page.locator(A11Y_TABLE)).toHaveCount(0);
    });
  }

  test('paginates frames when a panel has more than 5 series', async ({ gotoDashboardPage, selectors, page }) => {
    // The "Table" panel queries random_walk with 8 series, producing 8 source frames -> 8 tables.
    const dashboardPage = await gotoDashboardPage({
      uid: TIMESERIES_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-31' }),
    });
    await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Table'))).toBeVisible();

    const a11yTable = page.locator(A11Y_TABLE);
    await expect(a11yTable).toBeAttached();

    // first page shows FRAMES_PER_PAGE of the 8 frame tables
    await expect(a11yTable.locator('table')).toHaveCount(FRAMES_PER_PAGE);

    const framePager = a11yTable.locator('[role="group"][aria-label="Data tables"]');
    await expect(framePager).toContainText('Page 1 of 2');

    // navigate via keyboard, mirroring how a screen-reader user operates these sr-only controls
    await framePager.locator('button', { hasText: 'Next page' }).focus();
    await page.keyboard.press('Enter');

    // second page shows the remaining 3 tables
    await expect(a11yTable.locator('table')).toHaveCount(8 - FRAMES_PER_PAGE);
    await expect(framePager).toContainText('Page 2 of 2');
  });

  test('paginates rows when a frame has more than 25 rows', async ({ gotoDashboardPage, selectors, page }) => {
    // The "Lines 500 data points" panel renders a single 500-row frame.
    const dashboardPage = await gotoDashboardPage({
      uid: TIMESERIES_UID,
      queryParams: new URLSearchParams({ viewPanel: 'panel-47' }),
    });
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Lines 500 data points'))
    ).toBeVisible();

    const a11yTable = page.locator(A11Y_TABLE);
    await expect(a11yTable).toBeAttached();

    // a single frame -> a single table, paginated at ROWS_PER_PAGE rows per page
    await expect(a11yTable.locator('table')).toHaveCount(1);
    await expect(a11yTable.locator('tbody tr')).toHaveCount(ROWS_PER_PAGE);

    const rowPager = a11yTable.locator('[role="group"][aria-label="Table rows"]');
    await expect(rowPager).toContainText('Page 1 of');

    // navigate via keyboard, mirroring how a screen-reader user operates these sr-only controls
    await rowPager.locator('button', { hasText: 'Next page' }).focus();
    await page.keyboard.press('Enter');

    await expect(rowPager).toContainText('Page 2 of');
    await expect(a11yTable.locator('tbody tr')).toHaveCount(ROWS_PER_PAGE);
  });
});
