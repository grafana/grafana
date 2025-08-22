import { test, expect } from '@grafana/plugin-e2e';

test.describe(
  'Solo Route',
  {
    tag: ['@various'],
  },
  () => {
    test('Can view panels with shared queries in fullscreen', async ({ page, selectors }) => {
      // open Panel Tests - Bar Gauge
      const soloPanelUrl = selectors.pages.SoloPanel.url('ZqZnVvFZz/datasource-tests-shared-queries?orgId=1&panelId=4');
      await page.goto(soloPanelUrl);

      // Check that there are 6 canvas elements
      const canvasElements = page.locator('canvas');
      await expect(canvasElements).toHaveCount(6);
    });

    test('Can view solo panel in scenes', async ({ page, selectors }) => {
      // open Panel Tests - Graph NG
      const soloPanelUrl = selectors.pages.SoloPanel.url(
        'TkZXxlNG3/panel-tests-graph-ng?orgId=1&from=1699954597665&to=1699956397665&panelId=54&__feature.dashboardSceneSolo=true'
      );
      await page.goto(soloPanelUrl);

      // Check that the panel title exists
      const panelTitle = page.getByTestId(selectors.components.Panels.Panel.title('Interpolation: Step before'));
      await expect(panelTitle).toBeVisible();

      // Check that uplot-main-div does not exist
      const uplotDiv = page.getByText('uplot-main-div');
      await expect(uplotDiv).toBeHidden();
    });

    test('Can view solo repeated panel in scenes', async ({ page, selectors }) => {
      // open Panel Tests - Graph NG
      const soloPanelUrl = selectors.pages.SoloPanel.url(
        'templating-repeating-panels/templating-repeating-panels?orgId=1&from=1699934989607&to=1699956589607&panelId=A$panel-2&__feature.dashboardSceneSolo=true'
      );
      await page.goto(soloPanelUrl);

      // Check that the panel title exists
      const panelTitle = page.getByTestId(selectors.components.Panels.Panel.title('server=A'));
      await expect(panelTitle).toBeVisible();

      // Check that uplot-main-div does not exist
      const uplotDiv = page.getByText('uplot-main-div');
      await expect(uplotDiv).toBeHidden();
    });

    test('Can view solo in repeated row and panel in scenes', async ({ page, selectors }) => {
      // open Panel Tests - Graph NG
      const soloPanelUrl = selectors.pages.SoloPanel.url(
        'Repeating-rows-uid/repeating-rows?orgId=1&var-server=A&var-server=B&var-server=D&var-pod=1&var-pod=2&var-pod=3&panelId=B$2$panel-2&__feature.dashboardSceneSolo=true'
      );
      await page.goto(soloPanelUrl);

      // Check that the panel title exists
      const panelTitle = page.getByTestId(selectors.components.Panels.Panel.title('server = B, pod = Rob'));
      await expect(panelTitle).toBeVisible();

      // Check that uplot-main-div does not exist
      const uplotDiv = page.getByText('uplot-main-div');
      await expect(uplotDiv).toBeHidden();
    });
  }
);
