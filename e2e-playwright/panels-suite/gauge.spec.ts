import { test, expect } from '@grafana/plugin-e2e';

// this test requires a larger viewport so all gauge panels load properly
test.use({
  viewport: { width: 1280, height: 3000 },
});

const OLD_GAUGES_DASHBOARD_UID = '_5rDmaQiz';
const NEW_GAUGES_DASHBOARD_UID = 'panel-tests-gauge-new';
const OLD_TO_NEW_GAUGES_DASHBOARD_UID = 'panel-tests-old-gauge-to-new';

const OLD_GAUGES_DASHBOARD_GAUGE_COUNT = 16;
const NEW_GAUGE_DASHBOARD_GAUGE_COUNT = 36;

test.describe(
  'Gauge Panel',
  {
    tag: ['@panels', '@gauge'],
  },
  () => {
    test('a11y', { tag: ['@a11y'] }, async ({ scanForA11yViolations, selectors, gotoDashboardPage }) => {
      const dashboardPage = await gotoDashboardPage({ uid: NEW_GAUGES_DASHBOARD_UID });
      await expect(
        dashboardPage.getByGrafanaSelector(selectors.components.Panels.Visualization.Gauge.Container)
      ).toHaveCount(NEW_GAUGE_DASHBOARD_GAUGE_COUNT);
      const results = await scanForA11yViolations();
      // there's a dashboards issue with this rule right now - headers have aria-role="heading" but are missing aria-level
      expect(results).toHaveNoA11yViolations({ ignoredRules: ['aria-required-attr'] });
    });

    test('successfully migrates all gauge panels', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: OLD_GAUGES_DASHBOARD_UID });

      // check that gauges are rendered
      const gaugeElements = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.Gauge.Container
      );
      await expect(gaugeElements).toHaveCount(OLD_GAUGES_DASHBOARD_GAUGE_COUNT);

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
      await expect(gaugeElements).toHaveCount(NEW_GAUGE_DASHBOARD_GAUGE_COUNT);

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

    test('handles percentage units', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: OLD_TO_NEW_GAUGES_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: '20' }),
      });

      const gaugeLocator = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Visualization.Gauge.Container
      );

      await expect(gaugeLocator).toBeVisible();

      const computedColor = await gaugeLocator.evaluate((el) => {
        const pathsInSVG = el.querySelectorAll('path');
        return window.getComputedStyle(pathsInSVG[pathsInSVG.length - 1]).stroke;
      });

      // Assert that the color matches the expected RGB value
      expect(computedColor).toBe('rgb(115, 191, 105)');
    });
  }
);
