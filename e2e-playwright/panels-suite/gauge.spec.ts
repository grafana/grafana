import { test, expect } from '@grafana/plugin-e2e';

// this test requires a larger viewport so all gauge panels load properly
test.use({
  featureToggles: { newGauge: true },
  viewport: { width: 1280, height: 3000 },
});

const OLD_GAUGES_DASHBOARD_UID = '_5rDmaQiz';
const NEW_GAUGES_DASHBOARD_UID = 'panel-tests-gauge-new';

test.describe(
  'Gauge Panel',
  {
    tag: ['@panels', '@gauge'],
  },
  () => {
    test('successfully migrates all gauge panels', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: OLD_GAUGES_DASHBOARD_UID });

      // check that gauges are rendered
      const gaugeElements = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.Gauge.Container
      );
      await expect(gaugeElements).toHaveCount(16);

      // check that no panel errors exist
      const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
      await expect(errorInfo).toBeHidden();
    });

    test('renders new gauge panels', async ({ gotoDashboardPage, selectors }) => {
      // open Panel Tests - Gauge
      const dashboardPage = await gotoDashboardPage({ uid: NEW_GAUGES_DASHBOARD_UID });

      // check that gauges are rendered
      const gaugeElements = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.Gauge.Container
      );
      await expect(gaugeElements).toHaveCount(33); // the multi-link panel will not render the container, so it's 34 minus 1.

      // check that no panel errors exist
      const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
      await expect(errorInfo).toBeHidden();
    });

    test('renders sparklines in gauge panels', async ({ gotoDashboardPage, page }) => {
      await gotoDashboardPage({
        uid: NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '11' }),
      });

      await expect(page.locator('.uplot')).toHaveCount(5);
    });

    test('data links', async ({ gotoDashboardPage, selectors, page }) => {
      const singleLinkPanel = await gotoDashboardPage({
        uid: NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '38' }),
      });

      await expect(
        singleLinkPanel.getByGrafanaSelector(selectors.components.DataLinksContextMenu.singleLink)
      ).toBeVisible();

      const multiLinkPanel = await gotoDashboardPage({
        uid: NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '39' }),
      });

      await expect(
        multiLinkPanel.getByGrafanaSelector(selectors.components.Panels.Panel.title('Multiple links'))
      ).toBeVisible();
      await expect(
        multiLinkPanel.getByGrafanaSelector(selectors.components.Menu.MenuComponent('Context'))
      ).not.toBeVisible();
      await page.locator('[aria-label="Gauge"]').click();
      await expect(
        multiLinkPanel.getByGrafanaSelector(selectors.components.Menu.MenuComponent('Context'))
      ).toBeVisible();
    });

    test('"no data"', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '36' }),
      });

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Gauge.Container),
        'that the gauge does not appear'
      ).toBeHidden();

      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'that the empty text appears'
      ).toHaveText('No data');

      // update the "No value" option and see if the panel updates
      const noValueOption = dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel('Standard options No value'))
        .locator('input');

      await noValueOption.fill('My empty value');
      await noValueOption.blur();
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Gauge.Container),
        'that the empty text shows up in an empty gauge'
      ).toHaveText('My empty value');

      // test the "no numeric fields" message on the next panel
      const dashboardPage2 = await gotoDashboardPage({
        uid: NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '37' }),
      });

      await expect(
        dashboardPage2.getByGrafanaSelector(selectors.components.Panels.Visualization.Gauge.Container),
        'that the gauge does not appear'
      ).toBeHidden();

      await expect(
        dashboardPage2.getByGrafanaSelector(selectors.components.Panels.Panel.PanelDataErrorMessage),
        'that the empty text appears'
      ).toHaveText('Data is missing a number field');
    });
  }
);
