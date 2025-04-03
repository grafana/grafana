import { Interception } from 'cypress/types/net-stubbing';
import { load } from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';

import { selectors as rawSelectors } from '@grafana/e2e-selectors';

import { selectors } from '../../public/app/plugins/datasource/azuremonitor/e2e/selectors';
import {
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceSecureJsonData,
  AzureQueryType,
} from '../../public/app/plugins/datasource/azuremonitor/types';
import { e2e } from '../utils';

const provisioningPath = `provisioning/datasources/azmonitor-ds.yaml`;
const e2eSelectors = e2e.getSelectors(selectors.components);

type AzureMonitorConfig = {
  secureJsonData: AzureMonitorDataSourceSecureJsonData;
  jsonData: AzureMonitorDataSourceJsonData;
};

type AzureMonitorProvision = { datasources: AzureMonitorConfig[] };

const dataSourceName = `Azure Monitor E2E Tests - ${uuidv4()}`;

const maxRetryCount = 3;

Cypress.Commands.add('checkHealthRetryable', function (fn: Function, retryCount: number) {
  cy.then(() => {
    const result = fn(++retryCount);
    result.then((res: Interception) => {
      if (retryCount < maxRetryCount && res.response.statusCode !== 200) {
        cy.wait(20000);
        cy.checkHealthRetryable(fn, retryCount);
      }
    });
  });
});

function provisionAzureMonitorDatasources(datasources: AzureMonitorProvision[]) {
  const datasource = datasources[0].datasources[0];

  cy.intercept(/subscriptions/).as('subscriptions');

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

      // We can do this because awaitHealth is set to true so @health is defined
      cy.checkHealthRetryable(() => {
        return e2e.pages.DataSource.saveAndTest().click().wait('@health');
      }, 0);
    },
    expectedAlertMessage: 'Successfully connected to all Azure Monitor endpoints',
    // Reduce the timeout from 30s to error faster when an invalid alert message is presented
    timeout: 10000,
    awaitHealth: true,
  });
}

// Helper function to add template variables
const addAzureMonitorVariable = (
  name: string,
  type: AzureQueryType,
  isFirst: boolean,
  options?: { subscription?: string; resourceGroup?: string; namespace?: string; resource?: string; region?: string }
) => {
  e2e.components.NavToolbar.editDashboard.editButton().should('be.visible').click();
  e2e.components.NavToolbar.editDashboard.settingsButton().should('be.visible').click();
  e2e.components.Tab.title('Variables').click();
  if (isFirst) {
    e2e.pages.Dashboard.Settings.Variables.List.addVariableCTAV2().click();
  } else {
    cy.get(`[data-testid="${rawSelectors.pages.Dashboard.Settings.Variables.List.newButton}"]`).click();
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
  e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
  e2e.components.NavToolbar.editDashboard.exitButton().click();
};

const storageAcctName = 'azmonteststorage';
const logAnalyticsName = 'az-mon-test-logs';
const applicationInsightsName = 'az-mon-test-ai-a';

describe('Azure monitor datasource', () => {
  before(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));

    // Add datasource
    // This variable will be set in CI
    const CI = Cypress.env('CI');
    if (CI) {
      cy.readFile('outputs.json').then((outputs) => {
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
      cy.readFile(provisioningPath).then((azMonitorProvision: string) => {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const yaml = load(azMonitorProvision) as AzureMonitorProvision;
        provisionAzureMonitorDatasources([yaml]);
      });
    }
    e2e.setScenarioContext({ addedDataSources: [] });
  });

  beforeEach(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
  });

  after(() => {
    e2e.flows.login(Cypress.env('USERNAME'), Cypress.env('PASSWORD'));
    e2e.flows.revertAllChanges();
  });

  it('create dashboard, add panel for metrics, log analytics, ARG, and traces queries', () => {
    e2e.flows.addDashboard({
      timeRange: {
        from: 'now-6h',
        to: 'now',
        zone: 'Coordinated Universal Time',
      },
    });
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search
          .input()
          .wait(100)
          .type(storageAcctName)
          .wait(500)
          .type('{enter}');
        cy.contains(storageAcctName).click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        cy.contains('microsoft.storage/storageaccounts');
        e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Used capacity{enter}');
      },
      timeout: 10000,
    });
    e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
    e2e.components.NavToolbar.editDashboard.exitButton().click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.header.select().find('input').type('Logs{enter}');
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search
          .input()
          .wait(100)
          .type(logAnalyticsName)
          .wait(500)
          .type('{enter}');
        cy.contains(logAnalyticsName).click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        e2e.components.CodeEditor.container().type('AzureDiagnostics');
        e2eSelectors.queryEditor.logsQueryEditor.formatSelection.input().type('Time series{enter}');
      },
      timeout: 10000,
    });
    e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
    e2e.components.NavToolbar.editDashboard.exitButton().click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.header.select().find('input').type('Azure Resource Graph{enter}');
        cy.wait(1000); // Need to wait for code editor to completely load
        e2eSelectors.queryEditor.argsQueryEditor.subscriptions.input().find('[aria-label="Clear value"]').click();
        e2eSelectors.queryEditor.argsQueryEditor.subscriptions.input().find('input').type('datasources{enter}');
        e2e.components.CodeEditor.container().type(
          "Resources | where resourceGroup == 'cloud-plugins-e2e-test-azmon' | project name, resourceGroup"
        );
        e2e.components.PanelEditor.toggleTableView().click({ force: true });
      },
      timeout: 10000,
    });
    e2e.components.NavToolbar.editDashboard.backToDashboardButton().click();
    e2e.components.NavToolbar.editDashboard.exitButton().click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.header.select().find('input').type('Traces{enter}');
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search
          .input()
          .wait(100)
          .type(applicationInsightsName)
          .wait(500)
          .type('{enter}');
        cy.contains(applicationInsightsName).click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        cy.wait(10000);
        e2eSelectors.queryEditor.logsQueryEditor.formatSelection.input().type('Trace{enter}');
      },
      timeout: 10000,
    });
  });

  it('creates a dashboard that includes a template variable', () => {
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
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('subscription')
      .parent()
      .within(() => {
        cy.get('input').click();
      });
    e2e.components.Select.option().contains('grafanalabs-datasources-dev').click();
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resourceGroups')
      .parent()
      .within(() => {
        cy.get('input').type('cloud-plugins-e2e-test-azmon{downArrow}{enter}');
      });
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('namespaces')
      .parent()
      .within(() => {
        cy.get('input').type('microsoft.storage/storageaccounts{downArrow}{enter}');
      });
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('region')
      .parent()
      .within(() => {
        cy.get('input').type('uk south{downArrow}{enter}');
      });
    e2e.pages.Dashboard.SubMenu.submenuItemLabels('resource')
      .parent()
      .within(() => {
        cy.get('input').type(`${storageAcctName}{downArrow}{enter}`);
      });
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
      timeout: 10000,
    });
  });

  it.skip('creates a dashboard that includes an annotation', () => {
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
    e2eSelectors.queryEditor.resourcePicker.search.input().type(storageAcctName);
    cy.contains(storageAcctName).click();
    e2eSelectors.queryEditor.resourcePicker.apply.button().click();
    cy.contains('microsoft.storage/storageaccounts');
    e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Transactions{enter}');
    cy.get('table').contains('text').parent().find('input').click().type('Transactions (number){enter}');
    e2e.components.PageToolbar.item('Go Back').click();
    e2e.flows.addPanel({
      dataSourceName,
      visitDashboardAtStart: false,
      queriesForm: () => {
        e2eSelectors.queryEditor.resourcePicker.select.button().click();
        e2eSelectors.queryEditor.resourcePicker.search.input().type(storageAcctName);
        cy.contains(storageAcctName).click();
        e2eSelectors.queryEditor.resourcePicker.apply.button().click();
        cy.contains('microsoft.storage/storageaccounts');
        e2eSelectors.queryEditor.metricsQueryEditor.metricName.input().find('input').type('Used capacity{enter}');
      },
    });
  });
});
