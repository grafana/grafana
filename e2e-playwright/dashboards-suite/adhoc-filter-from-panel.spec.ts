import { first } from 'lodash';

import { test, expect } from '@grafana/plugin-e2e';

import testDashboard from '../dashboards/AdHocFilterTest.json';
import { getCell } from '../panels-suite/table-utils';

const fixture = require('../fixtures/prometheus-response.json');

test.describe(
  'Dashboard with Table powered by Prometheus data source',
  {
    tag: ['@dashboards'],
  },
  () => {
    let dashboardUID: string;

    test.beforeAll(async ({ request }) => {
      // Import the test dashboard
      const response = await request.post('/api/dashboards/import', {
        data: {
          dashboard: testDashboard,
          folderUid: '',
          overwrite: true,
          inputs: [],
        },
      });
      const responseBody = await response.json();
      dashboardUID = responseBody.uid;
    });

    test.afterAll(async ({ request }) => {
      // Clean up the imported dashboard
      if (dashboardUID) {
        await request.delete(`/api/dashboards/uid/${dashboardUID}`);
      }
    });

    test('Should add adhoc filter when clicking "Filter for value" button on table cell', async ({
      page,
      gotoDashboardPage,
      selectors,
    }) => {
      // Handle query and query_range API calls. Ideally, this would instead be directly tested against gdev-prometheus.
      await page.route(/\/api\/ds\/query/, async (route) => {
        const response = JSON.parse(JSON.stringify(fixture));

        // This simulates the behavior of prometheus applying a filter and removing dataframes from the response where
        // the label matches the selected filter. We check for either the slice being applied inline into the prometheus
        // query or the adhoc filter being present in the request body of prometheus applying that filter and removing
        // dataframes from the response.
        const postData = route.request().postData();
        const match =
          postData?.match(/{slice=\\\"([\w_]+)\\\"}/) ??
          postData?.match(/"adhocFilters":\[{"key":"slice","operator":"equals","value":"([\w_]+)"}\]/);
        if (match) {
          response.results.A.frames = response.results.A.frames.filter((frame) =>
            frame.schema.fields.every((field) => !field.labels || field.labels.slice === match[1])
          );
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        });
      });

      const dashboardPage = await gotoDashboardPage({ uid: dashboardUID });

      let panel = dashboardPage.getByGrafanaSelector(
        selectors.components.Panels.Panel.title('Table powered by Prometheus')
      );
      await expect(panel, 'panel is rendered').toBeVisible();

      // Wait for the table to load completely
      const table = panel.locator('.rdg');
      await expect(table, 'table is rendered').toBeVisible();

      const firstValue = (await getCell(table, 1, 1).textContent())!;
      const secondValue = (await getCell(table, 2, 1).textContent())!;
      expect(firstValue, `first cell is "${firstValue}"`).toBeTruthy();
      expect(secondValue, `second cell is "${secondValue}"`).toBeTruthy();
      expect(firstValue, 'first and second cell values are different').not.toBe(secondValue);

      async function performTest(labelValue: string) {
        // Confirm both cells are rendered before we proceed
        const otherValue = labelValue === firstValue ? secondValue : firstValue;
        await expect(table.getByText(labelValue), `"${labelValue}" is rendered`).toContainText(labelValue);
        await expect(table.getByText(otherValue), `"${otherValue}" is rendered`).toContainText(otherValue);

        // click the "Filter for value" button on the cell with the specified labelValue
        await table.getByText(labelValue).hover();
        table.getByText(labelValue).getByRole('button', { name: 'Filter for value' }).click();

        // Look for submenu items that contain the filtered value
        // The adhoc filter should appear as a filter chip or within the variable controls
        const submenuItems = dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItem);
        await expect(submenuItems.filter({ hasText: labelValue }), `submenu contains "${labelValue}"`).toBeVisible();
        await expect(
          submenuItems.filter({ hasText: otherValue }),
          `submenu does not contain "${otherValue}"`
        ).toBeHidden();

        // The URL parameter should contain the filter in format like: var-PromAdHoc=["columnName","=","value"]
        const currentUrl = page.url();
        const urlParams = new URLSearchParams(new URL(currentUrl).search);
        const promAdHocParam = urlParams.get('var-PromAdHoc');
        expect(promAdHocParam, `url contains "${labelValue}"`).toContain(labelValue);
        expect(promAdHocParam, `url does not contain "${otherValue}"`).not.toContain(otherValue);

        // finally, let's check that the table was updated and that the value was filtered out when the query was re-run
        await expect(table.getByText(labelValue), `"${labelValue}" is still visible`).toHaveText(labelValue);
        await expect(table.getByText(otherValue), `"${otherValue}" is filtered out`).toBeHidden();

        // Remove the adhoc filter by clicking the submenu item again
        const filterChip = submenuItems.filter({ hasText: labelValue });
        await filterChip.getByLabel(/Remove filter with key/).click();
        await page.click('body', { position: { x: 0, y: 0 } }); // click outside to close the open menu from ad-hoc filters

        // the "first" and "second" cells locators don't work here for some reason.
        await expect(table.getByText(labelValue), `"${labelValue}" is still rendered`).toContainText(labelValue);
        await expect(table.getByText(otherValue), `"${otherValue}" is rendered again`).toContainText(otherValue);
      }

      await performTest(firstValue);
      await performTest(secondValue);
    });
  }
);
