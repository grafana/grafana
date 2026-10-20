import { getTemplateSrv } from '@grafana/runtime';

import UrlBuilder from '../azure_monitor/url_builder';
import { parseResourceDetails, resourcesToStrings, setResources } from '../components/ResourcePicker/utils';
import { type AzureMonitorResource } from '../dataquery.gen';

jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({
    replace: (value: string) => value,
  }),
}));

describe('Azure Monitor edge machine selection', () => {
  const resourceId =
    '/subscriptions/sub/resourceGroups/edge-resources/providers/Microsoft.AzureStackHCI/edgeMachines/edge-machine';

  const manualResource: AzureMonitorResource = {
    subscription: 'sub',
    resourceGroup: 'edge-resources',
    metricNamespace: 'Microsoft.AzureStackHCI/edgeMachines',
    resourceName: 'edge-machine',
    region: 'northeurope',
  };

  it.each([
    { selection: 'resource picker', resource: parseResourceDetails(resourceId, 'northeurope') },
    { selection: 'advanced entry', resource: manualResource },
  ])('preserves the resource ID and metadata scope after $selection', ({ resource }) => {
    const query = setResources({ refId: 'A' }, 'metrics', [resource]);

    expect(query).toMatchObject({
      subscription: 'sub',
      azureMonitor: {
        metricNamespace: 'microsoft.azurestackhci/edgemachines',
        region: 'northeurope',
        resources: [
          {
            subscription: 'sub',
            resourceGroup: 'edge-resources',
            metricNamespace: 'Microsoft.AzureStackHCI/edgeMachines',
            resourceName: 'edge-machine',
            region: 'northeurope',
          },
        ],
      },
    });
    expect(resourcesToStrings(query.azureMonitor?.resources ?? [])).toEqual([resourceId]);

    const metadataScope = {
      subscription: query.subscription ?? '',
      resourceGroup: query.azureMonitor?.resources?.[0].resourceGroup ?? '',
      resourceName: query.azureMonitor?.resources?.[0].resourceName ?? '',
      metricNamespace: query.azureMonitor?.metricNamespace ?? '',
    };
    const templateSrv = getTemplateSrv();

    expect(
      UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
        'azuremonitor',
        '2017-12-01-preview',
        metadataScope,
        false,
        templateSrv
      )
    ).toBe(
      'azuremonitor/subscriptions/sub/resourceGroups/edge-resources/providers/microsoft.azurestackhci/edgemachines/edge-machine/providers/microsoft.insights/metricNamespaces?api-version=2017-12-01-preview'
    );
    expect(
      UrlBuilder.buildAzureMonitorGetMetricNamesUrl('azuremonitor', '2018-01-01', metadataScope, templateSrv)
    ).toBe(
      'azuremonitor/subscriptions/sub/resourceGroups/edge-resources/providers/microsoft.azurestackhci/edgemachines/edge-machine/providers/microsoft.insights/metricdefinitions?api-version=2018-01-01'
    );
  });
});
