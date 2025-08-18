import { readFileSync } from 'fs';
import { load } from 'js-yaml';
import { Page } from 'playwright-core';
import { v4 as uuidv4 } from 'uuid';

import {
  CreateDataSourcePageArgs,
  DashboardPage,
  DataSourceConfigPage,
  E2ESelectorGroups,
  expect,
  test,
} from '@grafana/plugin-e2e';

import { AzureQueryType } from '../../public/app/plugins/datasource/azuremonitor/dataquery.gen';
import { selectors as azMonSelectors } from '../../public/app/plugins/datasource/azuremonitor/e2e/selectors';
import {
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceSecureJsonData,
} from '../../public/app/plugins/datasource/azuremonitor/types/types';

const provisioningPath = 'provisioning/datasources/azmonitor-ds.yaml';

type AzureMonitorConfig = {
  secureJsonData: AzureMonitorDataSourceSecureJsonData;
  jsonData: AzureMonitorDataSourceJsonData;
};

type AzureMonitorProvision = { datasources: AzureMonitorConfig[] };

const dataSourceName = `Azure Monitor E2E Tests - ${uuidv4()}`;
const storageAcctName = 'azmonteststorage';
const logAnalyticsName = 'az-mon-test-logs';
const applicationInsightsName = 'az-mon-test-ai-a';
const rootSubscription = 'grafanalabs-datasources-dev';

async function provisionAzureMonitorDatasources(
  createDataSourceConfigPage: (args: CreateDataSourcePageArgs) => Promise<DataSourceConfigPage>,
  datasourceConfig: AzureMonitorConfig,
  page: Page,
  selectors: E2ESelectorGroups
) {
  const configPage = await createDataSourceConfigPage({
    type: 'grafana-azure-monitor-datasource',
    name: dataSourceName,
  });

  const azureCloudInput = page.getByTestId(azMonSelectors.components.configEditor.azureCloud.input).locator('input');
  await azureCloudInput.fill('Azure');
  await azureCloudInput.press('Enter');
  const tenantIdInput = page.getByTestId(azMonSelectors.components.configEditor.tenantID.input).locator('input');
  await tenantIdInput.fill(datasourceConfig.jsonData.tenantId!);
  const clientIdInput = page.getByTestId(azMonSelectors.components.configEditor.clientID.input).locator('input');
  await clientIdInput.fill(datasourceConfig.jsonData.clientId!);
  const clientSecretInput = page
    .getByTestId(azMonSelectors.components.configEditor.clientSecret.input)
    .locator('input');
  await clientSecretInput.fill(datasourceConfig.secureJsonData.clientSecret!);
  const loadSubscriptionsButton = page.getByTestId(azMonSelectors.components.configEditor.loadSubscriptions.button);
  await loadSubscriptionsButton.click();
  const defaultSubscriptionInput = page
    .getByTestId(azMonSelectors.components.configEditor.defaultSubscription.input)
    .locator('input');
  await defaultSubscriptionInput.fill('datasources');
  await configPage
    .getByGrafanaSelector(selectors.components.Select.option)
    .filter({
      hasText: 'datasources',
    })
    .click();
  await configPage.saveAndTest();
}

test.describe(
  'Azure Monitor datasource',
  {
    tag: ['@cloud-plugins'],
  },
  () => {
    let datasourceConfig: AzureMonitorConfig;

    test.beforeAll(async () => {
      // Check if we're running in CI
      const CI = process.env.CI;
      if (CI) {
        const outputs = JSON.parse(readFileSync('/tmp/outputs.json', 'utf8'));
        datasourceConfig = {
          jsonData: {
            cloudName: 'Azure',
            tenantId: outputs.tenantId,
            clientId: outputs.clientId,
          },
          secureJsonData: { clientSecret: outputs.clientSecret },
        };
      } else {
        const yamlContent = readFileSync(provisioningPath, 'utf8');
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const yaml = load(yamlContent) as AzureMonitorProvision;
        datasourceConfig = yaml.datasources[0];
      }
    });

    test('create dashboard, add panel for metrics, log analytics, ARG, and traces queries', async ({
      createDataSourceConfigPage,
      gotoDashboardPage,
      selectors,
      page,
    }) => {
      // this test can absolutely take longer than the default 30s timeout
      test.setTimeout(120000);
      await provisionAzureMonitorDatasources(createDataSourceConfigPage, datasourceConfig, page, selectors);
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({
        timeRange: {
          from: 'now-6h',
          to: 'now',
          zone: 'Coordinated Universal Time',
        },
      });

      // Add metrics panel
      const metricsPanel = await dashboardPage.addPanel();

      // Select Azure Monitor datasource
      const datasourcePicker = metricsPanel.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
      await datasourcePicker.fill(dataSourceName);
      const datasourceList = metricsPanel.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText(dataSourceName).click();

      // Configure metrics query
      const resourcePickerButton = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.select.button);
      await resourcePickerButton.click();
      await expect(page.getByText(rootSubscription)).toBeVisible({ timeout: 30000 });
      const resourceSearchInput = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.search.input);
      await resourceSearchInput.fill(storageAcctName);
      await resourceSearchInput.press('Enter');
      await expect(page.getByText(storageAcctName)).toBeVisible({ timeout: 30000 });
      await page.getByText(storageAcctName).click();
      const applyButton = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.apply.button);
      await applyButton.click();
      await expect(page.getByText('microsoft.storage/storageaccounts')).toBeVisible();
      const metricNameInput = page
        .getByTestId(azMonSelectors.components.queryEditor.metricsQueryEditor.metricName.input)
        .locator('input');
      await metricNameInput.fill('Used capacity');
      await metricNameInput.press('Enter');

      // Save and go back to dashboard
      metricsPanel.backToDashboard();

      // Add logs panel
      const logsPanel = await dashboardPage.addPanel();

      // Select Azure Monitor datasource
      await datasourcePicker.fill(dataSourceName);
      await datasourceList.getByText(dataSourceName).click();

      // Switch to Logs query type
      const queryTypeSelect = page.getByTestId(azMonSelectors.components.queryEditor.header.select).locator('input');
      await queryTypeSelect.fill('Logs');
      await queryTypeSelect.press('Enter');

      // Configure logs query
      await resourcePickerButton.click();
      await expect(page.getByText(rootSubscription)).toBeVisible({ timeout: 30000 });
      await resourceSearchInput.fill(logAnalyticsName);
      await resourceSearchInput.press('Enter');
      await expect(page.getByText(logAnalyticsName)).toBeVisible({ timeout: 30000 });
      await page.getByText(logAnalyticsName).click();
      await applyButton.click();
      let codeEditor = logsPanel.getByGrafanaSelector(selectors.components.CodeEditor.container).locator('textarea');
      await codeEditor.fill('AzureDiagnostics', { force: true });
      const formatSelection = page
        .getByTestId(azMonSelectors.components.queryEditor.logsQueryEditor.formatSelection.input)
        .locator('input');
      await formatSelection.fill('Time series');
      await formatSelection.press('Enter');

      // Save and go back to dashboard
      logsPanel.backToDashboard();

      // Add Azure Resource Graph panel
      const resourceGraphPanel = await dashboardPage.addPanel();

      // Select Azure Monitor datasource
      await datasourcePicker.fill(dataSourceName);
      await datasourceList.getByText(dataSourceName).click();

      // Switch to Azure Resource Graph query type
      await queryTypeSelect.fill('Azure Resource Graph');
      await queryTypeSelect.press('Enter');

      // Configure Azure Resource Graph query
      const subscriptionsInput = page
        .getByTestId(azMonSelectors.components.queryEditor.argsQueryEditor.subscriptions.input)
        .locator('input');
      await subscriptionsInput.fill('datasources');
      await subscriptionsInput.press('Enter');
      codeEditor = resourceGraphPanel
        .getByGrafanaSelector(selectors.components.CodeEditor.container)
        .locator('textarea');
      await codeEditor.fill(
        "Resources | where resourceGroup == 'cloud-plugins-e2e-test-azmon' | project name, resourceGroup"
      );

      // Save and go back to dashboard
      resourceGraphPanel.backToDashboard();

      // Add traces panel
      const tracesPanel = await dashboardPage.addPanel();

      // Select Azure Monitor datasource
      await datasourcePicker.fill(dataSourceName);
      await datasourceList.getByText(dataSourceName).click();

      // Switch to Traces query type
      await queryTypeSelect.fill('Traces');
      await queryTypeSelect.press('Enter');

      // Configure traces query
      await resourcePickerButton.click();
      await expect(page.getByText(rootSubscription)).toBeVisible({ timeout: 30000 });
      await resourceSearchInput.fill(applicationInsightsName);
      await resourceSearchInput.press('Enter');
      await expect(page.getByText(applicationInsightsName)).toBeVisible({ timeout: 30000 });
      await page.getByText(applicationInsightsName).click();
      await applyButton.click();
      await formatSelection.fill('Trace');
      await formatSelection.press('Enter');
    });

    test('create dashboard with template variables', async ({
      createDataSourceConfigPage,
      gotoDashboardPage,
      page,
      selectors,
    }) => {
      await provisionAzureMonitorDatasources(createDataSourceConfigPage, datasourceConfig, page, selectors);
      // Create new dashboard
      const dashboardPage = await gotoDashboardPage({
        timeRange: {
          from: 'now-6h',
          to: 'now',
        },
      });

      // Add subscription variable
      await addAzureMonitorVariable(
        page,
        dashboardPage,
        selectors,
        'subscription',
        AzureQueryType.SubscriptionsQuery,
        true
      );

      // Add resource groups variable
      await addAzureMonitorVariable(
        page,
        dashboardPage,
        selectors,
        'resourceGroups',
        AzureQueryType.ResourceGroupsQuery,
        false,
        {
          subscription: '$subscription',
        }
      );

      // Add namespaces variable
      await addAzureMonitorVariable(
        page,
        dashboardPage,
        selectors,
        'namespaces',
        AzureQueryType.NamespacesQuery,
        false,
        {
          subscription: '$subscription',
          resourceGroup: '$resourceGroups',
        }
      );

      // Add region variable
      await addAzureMonitorVariable(page, dashboardPage, selectors, 'region', AzureQueryType.LocationsQuery, false, {
        subscription: '$subscription',
      });

      // Add resource variable
      await addAzureMonitorVariable(
        page,
        dashboardPage,
        selectors,
        'resource',
        AzureQueryType.ResourceNamesQuery,
        false,
        {
          subscription: '$subscription',
          resourceGroup: '$resourceGroups',
          namespace: '$namespaces',
          region: '$region',
        }
      );

      // Set variable values
      const subscriptionVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('subscription'))
        .locator('..')
        .locator('input');
      await subscriptionVariable.click();
      await dashboardPage
        .getByGrafanaSelector(selectors.components.Select.option)
        .filter({ hasText: 'grafanalabs-datasources-dev' })
        .click();

      const resourceGroupsVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('resourceGroups'))
        .locator('..')
        .locator('input');
      await resourceGroupsVariable.fill('cloud-plugins-e2e-test-azmon');
      await resourceGroupsVariable.press('ArrowDown');
      await resourceGroupsVariable.press('Enter');

      const namespacesVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('namespaces'))
        .locator('..')
        .locator('input');
      await namespacesVariable.fill('microsoft.storage/storageaccounts');
      await namespacesVariable.press('ArrowDown');
      await namespacesVariable.press('Enter');

      const regionVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('region'))
        .locator('..')
        .locator('input');
      await regionVariable.fill('uk south');
      await regionVariable.press('ArrowDown');
      await regionVariable.press('Enter');

      const resourceVariable = dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.SubMenu.submenuItemLabels('resource'))
        .locator('..')
        .locator('input');
      await resourceVariable.fill(storageAcctName);
      await resourceVariable.press('ArrowDown');
      await resourceVariable.press('Enter');

      // Add panel with template variables
      const newPanel = await dashboardPage.addPanel();

      const datasourcePicker = newPanel.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
      await datasourcePicker.fill(dataSourceName);
      const datasourceList = newPanel.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText(dataSourceName).click();

      const resourcePickerButton = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.select.button);
      await resourcePickerButton.click();
      const advancedCollapse = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.collapse);
      await advancedCollapse.click();
      const advancedSubscription = page
        .getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.subscription.input)
        .locator('input');
      await advancedSubscription.fill('$subscription');
      const advancedResourceGroup = page
        .getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.resourceGroup.input)
        .locator('input');
      await advancedResourceGroup.fill('$resourceGroups');
      const advancedNamespace = page
        .getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.namespace.input)
        .locator('input');
      await advancedNamespace.fill('$namespaces');
      const advancedRegion = page
        .getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.region.input)
        .locator('input');
      await advancedRegion.fill('$region');
      const advancedResource = page
        .getByTestId(azMonSelectors.components.queryEditor.resourcePicker.advanced.resource.input)
        .locator('input');
      await advancedResource.fill('$resource');

      const applyButton = page.getByTestId(azMonSelectors.components.queryEditor.resourcePicker.apply.button);
      await applyButton.click();

      const metricNameInput = page
        .getByTestId(azMonSelectors.components.queryEditor.metricsQueryEditor.metricName.input)
        .locator('input2'); // change to check the test fails correctly
      await metricNameInput.fill('Transactions');
      await metricNameInput.press('Enter');
    });

    // Helper function to add template variables
    async function addAzureMonitorVariable(
      page: Page,
      dashboardPage: DashboardPage,
      selectors: E2ESelectorGroups,
      name: string,
      type: AzureQueryType,
      isFirst: boolean,
      options?: {
        subscription?: string;
        resourceGroup?: string;
        namespace?: string;
        resource?: string;
        region?: string;
      }
    ) {
      // Navigate to variables settings
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.settingsButton).click();
      await dashboardPage.getByGrafanaSelector(selectors.components.Tab.title('Variables')).click();

      if (isFirst) {
        await dashboardPage
          .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.List.addVariableCTAV2)
          .click();
      } else {
        await page.getByTestId(selectors.pages.Dashboard.Settings.Variables.List.newButton).click();
      }

      // Configure variable
      const nameInput = dashboardPage.getByGrafanaSelector(
        selectors.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2
      );
      await nameInput.clear();
      await nameInput.fill(name);

      const datasourcePicker = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
      await datasourcePicker.fill(dataSourceName);
      const datasourceList = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
      await datasourceList.getByText(dataSourceName).click();

      const queryTypeInput = page
        .getByTestId(azMonSelectors.components.variableEditor.queryType.input)
        .locator('input');
      await queryTypeInput.fill(type.replace('Azure', '').trim());
      await queryTypeInput.press('Enter');

      // Configure type-specific options
      switch (type) {
        case AzureQueryType.ResourceGroupsQuery:
          if (options?.subscription) {
            const subscriptionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.subscription.input)
              .locator('input');
            await subscriptionInput.fill(options.subscription);
            await subscriptionInput.press('Enter');
          }
          break;
        case AzureQueryType.LocationsQuery:
          if (options?.subscription) {
            const subscriptionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.subscription.input)
              .locator('input');
            await subscriptionInput.fill(options.subscription);
            await subscriptionInput.press('Enter');
          }
          break;
        case AzureQueryType.NamespacesQuery:
          if (options?.subscription) {
            const subscriptionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.subscription.input)
              .locator('input');
            await subscriptionInput.fill(options.subscription);
            await subscriptionInput.press('Enter');
          }
          if (options?.resourceGroup) {
            const resourceGroupInput = page
              .getByTestId(azMonSelectors.components.variableEditor.resourceGroup.input)
              .locator('input');
            await resourceGroupInput.fill(options.resourceGroup);
            await resourceGroupInput.press('Enter');
          }
          break;
        case AzureQueryType.ResourceNamesQuery:
          if (options?.subscription) {
            const subscriptionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.subscription.input)
              .locator('input');
            await subscriptionInput.fill(options.subscription);
            await subscriptionInput.press('Enter');
          }
          if (options?.resourceGroup) {
            const resourceGroupInput = page
              .getByTestId(azMonSelectors.components.variableEditor.resourceGroup.input)
              .locator('input');
            await resourceGroupInput.fill(options.resourceGroup);
            await resourceGroupInput.press('Enter');
          }
          if (options?.namespace) {
            const namespaceInput = page
              .getByTestId(azMonSelectors.components.variableEditor.namespace.input)
              .locator('input');
            await namespaceInput.fill(options.namespace);
            await namespaceInput.press('Enter');
          }
          if (options?.region) {
            const regionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.region.input)
              .locator('input');
            await regionInput.fill(options.region);
            await regionInput.press('Enter');
          }
          break;
        case AzureQueryType.MetricNamesQuery:
          if (options?.subscription) {
            const subscriptionInput = page
              .getByTestId(azMonSelectors.components.variableEditor.subscription.input)
              .locator('input');
            await subscriptionInput.fill(options.subscription);
            await subscriptionInput.press('Enter');
          }
          if (options?.resourceGroup) {
            const resourceGroupInput = page
              .getByTestId(azMonSelectors.components.variableEditor.resourceGroup.input)
              .locator('input');
            await resourceGroupInput.fill(options.resourceGroup);
            await resourceGroupInput.press('Enter');
          }
          if (options?.namespace) {
            const namespaceInput = page
              .getByTestId(azMonSelectors.components.variableEditor.namespace.input)
              .locator('input');
            await namespaceInput.fill(options.namespace);
            await namespaceInput.press('Enter');
          }
          if (options?.resource) {
            const resourceInput = page
              .getByTestId(azMonSelectors.components.variableEditor.resource.input)
              .locator('input');
            await resourceInput.fill(options.resource);
            await resourceInput.press('Enter');
          }
          break;
      }

      // Save variable
      await dashboardPage
        .getByGrafanaSelector(selectors.pages.Dashboard.Settings.Variables.Edit.General.submitButton)
        .click();

      // Go back to dashboard
      await dashboardPage
        .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
        .click();
    }
  }
);
