import { GetMetricNamespacesQuery, GetMetricNamesQuery } from '../types';

export default class UrlBuilder {
  static buildResourceUri(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string
  ) {
    const metricDefinitionArray = metricDefinition.split('/');
    const resourceNameArray = resourceName.split('/');
    const provider = metricDefinitionArray.shift();
    const urlArray = ['/subscriptions', subscriptionId, 'resourceGroups', resourceGroup, 'providers', provider];
    if (metricDefinition.startsWith('Microsoft.Storage/storageAccounts/') && resourceNameArray.at(-1) !== 'default') {
      resourceNameArray.push('default');
    }
    if (metricDefinitionArray.length > 0) {
      for (const i in metricDefinitionArray) {
        urlArray.push(metricDefinitionArray[i]);
        urlArray.push(resourceNameArray[i]);
      }
    } else {
      urlArray.push(resourceNameArray[0]);
    }
    return urlArray.join('/');
  }

  static buildAzureMonitorGetMetricNamespacesUrl(baseUrl: string, apiVersion: string, query: GetMetricNamespacesQuery) {
    let resourceUri: string;

    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(subscription, resourceGroup, metricDefinition, resourceName);
    }

    return `${baseUrl}${resourceUri}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`;
  }

  static buildAzureMonitorGetMetricNamesUrl(baseUrl: string, apiVersion: string, query: GetMetricNamesQuery) {
    let resourceUri: string;
    const { metricNamespace } = query;

    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(subscription, resourceGroup, metricDefinition, resourceName);
    }

    return (
      `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}` +
      `&metricnamespace=${encodeURIComponent(metricNamespace)}`
    );
  }
}
