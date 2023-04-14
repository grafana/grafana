import { load } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';

import { e2e } from '@grafana/e2e';

import { selectors } from '../../public/app/plugins/datasource/azuremonitor/e2e/selectors';
import {
  AzureDataSourceJsonData,
  AzureDataSourceSecureJsonData,
  AzureQueryType,
} from '../../public/app/plugins/datasource/azuremonitor/types';

const provisioningPath = `../../provisioning/datasources/azmonitor-ds.yaml`;
const e2eSelectors = e2e.getSelectors(selectors.components);

type AzureMonitorConfig = {
  secureJsonData: AzureDataSourceSecureJsonData;
  jsonData: AzureDataSourceJsonData;
};

type AzureMonitorProvision = { datasources: AzureMonitorConfig[] };

const dataSourceName = `Azure Monitor E2E Tests - ${uuidv4()}`;

function provisionAzureMonitorDatasources(datasources: AzureMonitorProvision[]) {
  const datasource = datasources[0].datasources[0];

  e2e()
    .intercept(/subscriptions/)
    .as('subscriptions');

  e2e.flows.addDataSource({
    type: 'Azure Monitor',
    name: dataSourceName,
    form: () => {
      e2eSelectors.configEditor.azureCloud.input().find('input').type('Azure').type('{enter}');
      // We set the log value to false here to ensure that secrets aren't printed to logs
      e2eSelectors.configEditor.tenantID.input().find('input').type(datasource.jsonData.tenantId, { log: false });
      e2eSelectors.configEditor.clientID.input().find('input').type(datasource.jsonData.clientId, { log: false });
      e2eSelectors.configEditor.clientSecret
        .input()
        .find('input')
        .type(datasource.secureJsonData.clientSecret, { log: false });
      e2eSelectors.configEditor.loadSubscriptions.button().click().wait('@subscriptions').wait(500);
      e2eSelectors.configEditor.defaultSubscription.input().find('input').type('datasources{enter}');
      // Wait for 15s so that credentials are ready. 5s has been tested locally before and seemed insufficient.
      e2e().wait(30000);
    },
    expectedAlertMessage: 'Successfully connected to all Azure Monitor endpoints',
    // Reduce the timeout from 30s to error faster when an invalid alert message is presented
    timeout: 10000,
  });
}

const addAzureMonitorVariable = (
  name: string,
  type: AzureQueryType,
  isFirst: boolean,
  options?: { subscription?: string; resourceGroup?: string; namespace?: string; resource?: string; region?: string }
) => {
  e2e.components.PageToolbar.item('Dashboard settings').click();
  e2e.components.Tab.title('Variables').click();
  if (isFirst) {
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTAV2().click();
  } else {
    e2e.pages.Dashboard.Settings.Variables.List.newButton().click();
  }
  e2e.pages.Dashboard.Settings.Variables.Edit.General.generalNameInputV2().clear().type(name);
  e2e.components.DataSourcePicker.inputV2().type(`${dataSourceName}{enter}`);
  e2eSelectors.variableEditor.queryType
    .input()
    .find('input')
    .type(`${type.replace('Azure', '').trim()}{enter}`);
  switch (type) {
    case AzureQueryType.ResourceGroupsQuery:
      e2eSelectors.variableEditor.subscription.input().find('input').type(`${options?.subscription}{enter}`);
      break;
    case AzureQueryType.LocationsQuery:
      e2eSelectors.variableEditor.subscription.input().find('input').type(`${options?.subscription}{enter}`);
      break;
    case AzureQueryType.NamespacesQuery:
      e2eSelectors.variableEditor.subscription.input().find('input').type(`${options?.subscription}{enter}`);
      e2eSelectors.variableEditor.resourceGroup.input().find('input').type(`${options?.resourceGroup}{enter}`);
      break;
    case AzureQueryType.ResourceNamesQuery:
      e2eSelectors.variableEditor.subscription.input().find('input').type(`${options?.subscription}{enter}`);
      e2eSelectors.variableEditor.resourceGroup.input().find('input').type(`${options?.resourceGroup}{enter}`);
      e2eSelectors.variableEditor.namespace.input().find('input').type(`${options?.namespace}{enter}`);
      e2eSelectors.variableEditor.region.input().find('input').type(`${options?.region}{enter}`);
      break;
    case AzureQueryType.MetricNamesQuery:
      e2eSelectors.variableEditor.subscription.input().find('input').type(`${options?.subscription}{enter}`);
      e2eSelectors.variableEditor.resourceGroup.input().find('input').type(`${options?.resourceGroup}{enter}`);
      e2eSelectors.variableEditor.namespace.input().find('input').type(`${options?.namespace}{enter}`);
      e2eSelectors.variableEditor.resource.input().find('input').type(`${options?.resource}{enter}`);
      break;
  }
  e2e.pages.Dashboard.Settings.Variables.Edit.General.submitButton().click();
  e2e.pages.Dashboard.Settings.Actions.close().click();
};

e2e.scenario({
  describeName: 'Add Azure Monitor datasource',
  itName: 'fills out datasource connection configuration',
  scenario: () => {
    // This variable will be set in CI
    const CI = e2e.env('CI');
    if (CI) {
      e2e()
        .readFile('../../outputs.json')
        .then((outputs) => {
          provisionAzureMonitorDatasources([
            {
              datasources: [
                {
                  jsonData: {
                    cloudName: 'Azure',
                    tenantId: outputs.tenantId,
                    clientId: outputs.clientId,
                  },
                  secureJsonData: { clientSecret: outputs.clientSecret },
                },
              ],
            },
          ]);
        });
    } else {
      e2e()
        .readFile(provisioningPath)
        .then((azMonitorProvision: string) => {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          const yaml = load(azMonitorProvision) as AzureMonitorProvision;
          provisionAzureMonitorDatasources([yaml]);
        });
    }
    e2e.setScenarioContext({ addedDataSources: [] });
  },
});

e2e.scenario({
  describeName: 'Create dashboard and add a panel for each query type',
  itName: 'create dashboard, add panel for metrics query, log analytics query, and ARG query',
  scenario: () => {
    e2e.flows.addDashboard({
      timeRange: {
        from: 'now-6h',
        to: 'now',
        zone: 'Coordinated Universal Time',
      },
    });
    e2e()
      .intercept(/locations/)
      .as('locations');
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.resourcePicker.select.button().click().wait('@locations');
        e2eSelectors.queryEditor.resourcePicker.search
          .input()
          .wait(100)
          .type('azmonmetricstest')
          .wait(500)
          .type('{enter}');
        e2e().contains('azmonmetricstest').click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        e2e().contains('microsoft.storage/storageaccounts');
        e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Used capacity{enter}');
      },
    });
    e2e.components.PanelEditor.applyButton().click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.header.select().find('input').type('Logs{enter}');
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search
          .input()
          .wait(100)
          .type('azmonlogstest')
          .wait(500)
          .type('{enter}');
        e2e().contains('azmonlogstest').click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        e2e.components.CodeEditor.container().type('AzureDiagnostics');
        e2eSelectors.queryEditor.logsQueryEditor.formatSelection.input().type('Time series{enter}');
      },
    });
    e2e.components.PanelEditor.applyButton().click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.header.select().find('input').type('Azure Resource Graph{enter}');
        e2e().wait(1000); // Need to wait for code editor to completely load
        e2eSelectors.queryEditor.argsQueryEditor.subscriptions
          .input()
          .find('[aria-label="select-clear-value"]')
          .click();
        e2eSelectors.queryEditor.argsQueryEditor.subscriptions.input().find('input').type('datasources{enter}');
        e2e.components.CodeEditor.container().type(
          "Resources | where resourceGroup == 'cloud-plugins-e2e-test' | project name, resourceGroup"
        );
        e2e.components.PanelEditor.toggleTableView().click({ force: true });
      },
    });
  },
});

e2e.scenario({
  describeName: 'Create dashboard with template variables',
  itName: 'creates a dashboard that includes a template variable',
  scenario: () => {
    e2e.flows.addDashboard({
      timeRange: {
        from: 'now-6h',
        to: 'now',
        zone: 'Coordinated Universal Time',
      },
    });
    addAzureMonitorVariable('subscription', AzureQueryType.SubscriptionsQuery, true);
    addAzureMonitorVariable('resourceGroups', AzureQueryType.ResourceGroupsQuery, false, {
      subscription: '$subscription',
    });
    addAzureMonitorVariable('namespaces', AzureQueryType.NamespacesQuery, false, {
      subscription: '$subscription',
      resourceGroup: '$resourceGroups',
    });
    addAzureMonitorVariable('region', AzureQueryType.LocationsQuery, false, {
      subscription: '$subscription',
    });
    addAzureMonitorVariable('resource', AzureQueryType.ResourceNamesQuery, false, {
      subscription: '$subscription',
      resourceGroup: '$resourceGroups',
      namespace: '$namespace',
      region: '$region',
    });
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('subscription').click();
    e2e.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts('grafanalabs-datasources-dev').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resourceGroups').parent().find('button').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resourceGroups')
      .parent()
      .find('input')
      .type('cloud-plugins-e2e-test{downArrow}{enter}');
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('namespaces').parent().find('button').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('namespaces')
      .parent()
      .find('input')
      .type('microsoft.storage/storageaccounts{downArrow}{enter}');
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('region').parent().find('button').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('region').parent().find('input').type('uk south{downArrow}{enter}');
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resource').parent().find('button').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resource')
      .parent()
      .find('input')
      .type('azmonmetricstest{downArrow}{enter}');
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.advanced.collapse().click();
        e2eSelectors.queryEditor.resourcePicker.advanced.subscription.input().find('input').type('$subscription');
        e2eSelectors.queryEditor.resourcePicker.advanced.resourceGroup.input().find('input').type('$resourceGroups');
        e2eSelectors.queryEditor.resourcePicker.advanced.namespace.input().find('input').type('$namespaces');
        e2eSelectors.queryEditor.resourcePicker.advanced.region.input().find('input').type('$region');
        e2eSelectors.queryEditor.resourcePicker.advanced.resource.input().find('input').type('$resource');
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Transactions{enter}');
      },
    });
  },
});

e2e.scenario({
  describeName: 'Create dashboard with annotation',
  itName: 'creates a dashboard that includes an annotation',
  scenario: () => {
    e2e.flows.addDashboard({
      timeRange: {
        from: '2022-10-03 00:00:00',
        to: '2022-10-03 23:59:59',
        zone: 'Coordinated Universal Time',
      },
    });
    e2e.components.PageToolbar.item('Dashboard settings').click();
    e2e.components.Tab.title('Annotations').click();
    e2e.pages.Dashboard.Settings.Annotations.List.addAnnotationCTAV2().click();
    e2e.pages.Dashboard.Settings.Annotations.Settings.name().type('TestAnnotation');
    e2e.components.DataSourcePicker.inputV2().click().type(`${dataSourceName}{enter}`);
    e2eSelectors.queryEditor.resourcePicker.select.button().click();
    e2eSelectors.queryEditor.resourcePicker.search.input().type('azmonmetricstest');
    e2e().contains('azmonmetricstest').click();
    e2eSelectors.queryEditor.resourcePicker.apply.button().click();
    e2e().contains('microsoft.storage/storageaccounts');
    e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Transactions{enter}');
    e2e().get('table').contains('text').parent().find('input').click().type('Transactions (number){enter}');
    e2e.components.PageToolbar.item('Go Back').click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search.input().type('azmonmetricstest');
        e2e().contains('azmonmetricstest').click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        e2e().contains('microsoft.storage/storageaccounts');
        e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Used capacity{enter}');
      },
    });
  },
  skipScenario: true,
});

e2e.scenario({
  describeName: 'Remove datasource',
  itName: 'remove azure monitor datasource',
  scenario: () => {
    e2e.flows.deleteDataSource({ name: dataSourceName, id: '', quick: true });
  },
});
