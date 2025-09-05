import { random } from 'lodash';

import { test, expect } from '@grafana/plugin-e2e';

const DATASOURCE_ID = 'sandbox-test-datasource';
let DATASOURCE_CONNECTION_ID = '';
const TIMESTAMP = Date.now();
const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;

test.beforeAll(async ({ createDataSource }) => {
  // Add the datasource
  const response = await createDataSource({
    type: 'sandbox-test-datasource',
    name: DATASOURCE_TYPED_NAME,
  });
  DATASOURCE_CONNECTION_ID = response.uid;
});

test.describe(
  'Datasource sandbox',
  {
    tag: ['@various'],
  },
  () => {
    test.describe('Config Editor', () => {
      test.describe('Sandbox disabled', () => {
        test.beforeEach(async ({ page }) => {
          await page.evaluate(() => {
            localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
          });
        });

        test('Should not render a sandbox wrapper around the datasource config editor', async ({ page }) => {
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);

          const sandboxDiv = page.locator(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`);
          await expect(sandboxDiv).toBeHidden();
        });
      });

      test.describe('Sandbox enabled', () => {
        test.beforeEach(async ({ page }) => {
          await page.evaluate(() => {
            localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
          });
        });

        test('Should render a sandbox wrapper around the datasource config editor', async ({ page }) => {
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);

          const sandboxDiv = page.locator(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`);
          await expect(sandboxDiv).toBeVisible();
        });

        test('Should store values in jsonData and secureJsonData correctly', async ({ page }) => {
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);

          const valueToStore = 'test' + random(100);

          const queryInput = page.locator('[data-testid="sandbox-config-editor-query-input"]');
          await expect(queryInput).not.toBeDisabled();
          await queryInput.fill(valueToStore);
          await expect(queryInput).toHaveValue(valueToStore);

          const saveButton = page.getByTestId('data-testid Data source settings page Save and test button');
          await saveButton.click();

          const alert = page.locator('[data-testid="data-testid Alert"]');
          await expect(alert).toBeVisible();
          await expect(alert).toContainText('Sandbox Success');

          // validate the value was stored
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);
          await expect(queryInput).not.toBeDisabled();
          await expect(queryInput).toHaveValue(valueToStore);
        });
      });
    });

    test.describe('Explore Page', () => {
      test.describe('Sandbox disabled', () => {
        test.beforeEach(async ({ page }) => {
          await page.evaluate(() => {
            localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=0');
          });
        });

        test('Should not wrap the query editor in a sandbox wrapper', async ({ page, dashboardPage, selectors }) => {
          await page.goto('/explore');

          const dataSourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container);
          await expect(dataSourcePicker).toBeVisible();
          await dataSourcePicker.click();

          const datasourceOption = page.locator(`text=${DATASOURCE_TYPED_NAME}`);
          await expect(datasourceOption).toBeVisible();
          await datasourceOption.scrollIntoViewIfNeeded();
          await datasourceOption.click();

          // make sure the datasource was correctly selected and rendered
          const breadcrumb = dashboardPage.getByGrafanaSelector(
            selectors.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME)
          );
          await expect(breadcrumb).toBeVisible();

          await page.waitForTimeout(300); // wait to prevent false positives because playwright checks too fast
          const sandboxDiv = page.locator(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`);
          await expect(sandboxDiv).toBeHidden();
        });

        test('Should accept values when typed', async ({ page, dashboardPage, selectors }) => {
          await page.goto('/explore');

          const dataSourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container);
          await expect(dataSourcePicker).toBeVisible();
          await dataSourcePicker.click();

          const datasourceOption = page.locator(`text=${DATASOURCE_TYPED_NAME}`);
          await expect(datasourceOption).toBeVisible();
          await datasourceOption.scrollIntoViewIfNeeded();
          await datasourceOption.click();

          // make sure the datasource was correctly selected and rendered
          const breadcrumb = dashboardPage.getByGrafanaSelector(
            selectors.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME)
          );
          await expect(breadcrumb).toBeVisible();

          const valueToType = 'test' + random(100);

          const queryInput = page.locator('[data-testid="sandbox-query-editor-query-input"]');
          await expect(queryInput).not.toBeDisabled();
          await queryInput.fill(valueToType);
          await expect(queryInput).toHaveValue(valueToType);
        });
      });

      test.describe('Sandbox enabled', () => {
        test.beforeEach(async ({ page }) => {
          await page.evaluate(() => {
            localStorage.setItem('grafana.featureToggles', 'pluginsFrontendSandbox=1');
          });
        });

        test('Should wrap the query editor in a sandbox wrapper', async ({ page, dashboardPage, selectors }) => {
          await page.goto('/explore');

          const dataSourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container);
          await expect(dataSourcePicker).toBeVisible();
          await dataSourcePicker.click();

          const datasourceOption = page.locator(`text=${DATASOURCE_TYPED_NAME}`);
          await expect(datasourceOption).toBeVisible();
          await datasourceOption.scrollIntoViewIfNeeded();
          await datasourceOption.click();

          // make sure the datasource was correctly selected and rendered
          const breadcrumb = dashboardPage.getByGrafanaSelector(
            selectors.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME)
          );
          await expect(breadcrumb).toBeVisible();

          const sandboxDiv = page.locator(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`);
          await expect(sandboxDiv).toBeVisible();
        });

        test('Should accept values when typed', async ({ page, dashboardPage, selectors }) => {
          await page.goto('/explore');

          const dataSourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.container);
          await expect(dataSourcePicker).toBeVisible();
          await dataSourcePicker.click();

          const datasourceOption = page.locator(`text=${DATASOURCE_TYPED_NAME}`);
          await expect(datasourceOption).toBeVisible();
          await datasourceOption.scrollIntoViewIfNeeded();
          await datasourceOption.click();

          // make sure the datasource was correctly selected and rendered
          const breadcrumb = dashboardPage.getByGrafanaSelector(
            selectors.components.Breadcrumbs.breadcrumb(DATASOURCE_TYPED_NAME)
          );
          await expect(breadcrumb).toBeVisible();

          const valueToType = 'test' + random(100);

          const queryInput = page.locator('[data-testid="sandbox-query-editor-query-input"]');
          await expect(queryInput).not.toBeDisabled();
          await queryInput.fill(valueToType);
          await expect(queryInput).toHaveValue(valueToType);

          // typing the query editor should reflect in the url
          await expect(page).toHaveURL(new RegExp(valueToType));
        });
      });
    });

    test.afterEach(async ({ page }) => {
      // Clear cookies after each test
      await page.context().clearCookies();
    });
  }
);
