import { random } from 'lodash';

import { test, expect } from '@grafana/plugin-e2e';

const DATASOURCE_ID = 'sandbox-test-datasource';

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

        test('Should not render a sandbox wrapper around the datasource config editor', async ({
          page,
          createDataSource,
        }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
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

        test('Should render a sandbox wrapper around the datasource config editor', async ({
          page,
          createDataSource,
        }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);

          const sandboxDiv = page.locator(`div[data-plugin-sandbox="${DATASOURCE_ID}"]`);
          await expect(sandboxDiv).toBeVisible();
        });

        test('Should store values in jsonData and secureJsonData correctly', async ({ page, createDataSource }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
          await page.goto(`/connections/datasources/edit/${DATASOURCE_CONNECTION_ID}`);

          const valueToStore = 'test' + random(100);

          const queryInput = page.locator('[data-testid="sandbox-config-editor-query-input"]');
          await expect(queryInput).not.toBeDisabled();
          await queryInput.fill(valueToStore);
          await expect(queryInput).toHaveValue(valueToStore);

          const saveButton = page.getByTestId('data-testid Data source settings page Save and Test button');
          await saveButton.click();

          const alert = page.getByTestId('data-testid Data source settings page Alert');
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

        test('Should not wrap the query editor in a sandbox wrapper', async ({
          page,
          createDataSource,
          dashboardPage,
          selectors,
        }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
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
          await expect(sandboxDiv).toBeHidden();
        });

        test('Should accept values when typed', async ({ page, createDataSource, dashboardPage, selectors }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
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

        test('Should wrap the query editor in a sandbox wrapper', async ({
          page,
          createDataSource,
          dashboardPage,
          selectors,
        }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
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

        test('Should accept values when typed', async ({ page, createDataSource, dashboardPage, selectors }) => {
          const TIMESTAMP = Date.now();
          const DATASOURCE_TYPED_NAME = `SandboxDatasourceInstance-${TIMESTAMP}`;
          // Add the datasource
          const response = await createDataSource({
            type: DATASOURCE_ID,
            name: DATASOURCE_TYPED_NAME,
          });
          const DATASOURCE_CONNECTION_ID = response.uid;
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
