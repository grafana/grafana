import { e2e } from '@grafana/e2e';

import {
  AzureDataSourceJsonData,
  AzureDataSourceSecureJsonData,
} from '../../public/app/plugins/datasource/grafana-azure-monitor-datasource/types';
import EXAMPLE_DASHBOARD from './example-dashboards/azure-monitor.json';

import { load } from 'js-yaml';

const provisioningPath = `../../provisioning/datasources/azmonitor-ds.yaml`;

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
      e2e().get('[aria-label="Azure Cloud"]').type('Azure').type('{enter}'),
        e2e().get('[aria-label="Tenant ID"]').type(datasource.jsonData.tenantId),
        e2e().get('[aria-label="Client ID"]').type(datasource.jsonData.clientId),
        e2e().get('[aria-label="Client Secret"]').type(datasource.secureJsonData.clientSecret),
        e2e().get('[aria-label="Load Subscriptions"]').click().wait('@subscriptions');
      e2e().get('[aria-label="Default Subscription"]').should('contain.text', 'Primary Subscription').wait(500);
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
