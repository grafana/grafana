import { load } from 'js-yaml';
import { e2e } from '@grafana/e2e';

import {
  AzureDataSourceJsonData,
  AzureDataSourceSecureJsonData,
} from '../../public/app/plugins/datasource/grafana-azure-monitor-datasource/types';

import EXAMPLE_DASHBOARD from './example-dashboards/azure-monitor.json';
import { selectors } from '../../public/app/plugins/datasource/grafana-azure-monitor-datasource/e2e/selectors';

const provisioningPath = `../../provisioning/datasources/azmonitor-ds.yaml`;
const e2eSelectors = e2e.getSelectors(selectors.components);

type AzureMonitorConfig = {
  secureJsonData: AzureDataSourceSecureJsonData;
  jsonData: AzureDataSourceJsonData;
};

type AzureMonitorProvision = { datasources: AzureMonitorConfig[] };

function provisionAzureMonitorDatasources(datasources: AzureMonitorProvision[]) {
  const datasource = datasources[0].datasources[0];

  e2e()
    .intercept(/subscriptions/)
    .as('subscriptions');

  e2e.flows.addDataSource({
    type: 'Azure Monitor',
    form: () => {
      e2eSelectors.configEditor.azureCloud.input().find('input').type('Azure').type('{enter}'),
        e2eSelectors.configEditor.tenantID.input().find('input').type(datasource.jsonData.tenantId),
        e2eSelectors.configEditor.clientID.input().find('input').type(datasource.jsonData.clientId),
        e2eSelectors.configEditor.clientSecret.input().find('input').type(datasource.secureJsonData.clientSecret),
        e2eSelectors.configEditor.loadSubscriptions.button().click().wait('@subscriptions').wait(500);
    },
    expectedAlertMessage: 'Successfully connected to all Azure Monitor endpoints',
  });
}

e2e.scenario({
  describeName: 'Add Azure Monitor datasource and import dashboard',
  itName: 'fills out datasource connection configuration and imports JSON dashboard',
  scenario: () => {
    e2e()
      .readFile(provisioningPath)
      .then((azMonitorProvision: string) => {
        const yaml = load(azMonitorProvision) as AzureMonitorProvision;
        provisionAzureMonitorDatasources([yaml]);
        e2e.flows.importDashboard(EXAMPLE_DASHBOARD, undefined, true);
      });
  },
});

e2e.scenario({
  describeName: 'Create panel and run a metrics query',
  itName: 'configures datasource, adds a panel, runs a metrics query',
  scenario: () => {
    e2e()
      .readFile(provisioningPath)
      .then((azMonitorProvision: string) => {
        const yaml = load(azMonitorProvision) as AzureMonitorProvision;
        provisionAzureMonitorDatasources([yaml]);
        e2e.flows.addDashboard({
          timeRange: {
            from: '2022-10-03 00:00:00',
            to: '2022-10-03 23:59:59',
            zone: 'Coordinated Universal Time',
          },
        });
        e2e.flows.addPanel({
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
      });
  },
});

e2e.scenario({
  describeName: 'Create panel and run a logs query',
  itName: 'configures datasource, adds a panel, runs a logs query',
  scenario: () => {
    e2e()
      .readFile(provisioningPath)
      .then((azMonitorProvision: string) => {
        const yaml = load(azMonitorProvision) as AzureMonitorProvision;
        provisionAzureMonitorDatasources([yaml]);
        e2e.flows.addDashboard({
          timeRange: {
            from: '2022-10-03 00:00:00',
            to: '2022-10-03 23:59:59',
            zone: 'Coordinated Universal Time',
          },
        });
        e2e.flows.addPanel({
          visitDashboardAtStart: false,
          queriesForm: () => {
            e2eSelectors.queryEditor.header.select().find('input').type('Logs{enter}');
            e2eSelectors.queryEditor.resourcePicker.select.button().click();
            e2eSelectors.queryEditor.resourcePicker.search.input().type('azmonlogstest');
            e2e().contains('azmonlogstest').click();
            e2eSelectors.queryEditor.resourcePicker.apply.button().click();
            e2e.components.CodeEditor.container().type('AzureDiagnostics');
            e2eSelectors.queryEditor.logsQueryEditor.formatSelection.input().type('Time series{enter}');
          },
        });
      });
  },
});

e2e.scenario({
  describeName: 'Create panel and run an ARG query',
  itName: 'configures datasource, adds a panel, runs an ARG query',
  scenario: () => {
    e2e()
      .readFile(provisioningPath)
      .then((azMonitorProvision: string) => {
        const yaml = load(azMonitorProvision) as AzureMonitorProvision;
        provisionAzureMonitorDatasources([yaml]);
        e2e.flows.addDashboard({
          timeRange: {
            from: '2022-10-03 00:00:00',
            to: '2022-10-03 23:59:59',
            zone: 'Coordinated Universal Time',
          },
        });
        e2e.flows.addPanel({
          visitDashboardAtStart: false,
          queriesForm: () => {
            e2eSelectors.queryEditor.header.select().find('input').type('Azure Resource Graph{enter}');
            e2e().wait(500); // Need to wait for code editor to completely load
            e2e.components.CodeEditor.container().type(
              "Resources | where resourceGroup == 'cloud-plugins-e2e-test' | project name, resourceGroup"
            );
            e2e.components.PanelEditor.toggleTableView().click({ force: true });
          },
        });
      });
  },
});
