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
    for (const i in metricDefinitionArray) {
      urlArray.push(metricDefinitionArray[i]);
      urlArray.push(resourceNameArray[i]);
    }
    return urlArray.join('/');
  }

  static buildAzureMonitorGetMetricNamespacesUrl(
    baseUrl: string,
    apiVersion: string,
    query:
      | { resourceUri: string }
      | {
          subscription: string;
          resourceGroup: string;
          metricDefinition: string;
          resourceName: string;
        }
  ) {
    if ('resourceUri' in query) {
      const { resourceUri } = query;
      return `${baseUrl}${resourceUri}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`;
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName } = query;
      const urlPrefix = UrlBuilder.buildResourceUri(subscription, resourceGroup, metricDefinition, resourceName);
      return `${baseUrl}${urlPrefix}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`;
    }
  }

  static buildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
    apiVersion: string,
    query:
      | { resourceUri: string; metricNamespace: string }
      | {
          subscription: string;
          resourceGroup: string;
          metricDefinition: string;
          resourceName: string;
          metricNamespace: string;
        }
  ) {
    if ('resourceUri' in query) {
      const { resourceUri, metricNamespace } = query;
      return (
        `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}` +
        `&metricnamespace=${encodeURIComponent(metricNamespace)}`
      );
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName, metricNamespace } = query;
      const urlPrefix = UrlBuilder.buildResourceUri(subscription, resourceGroup, metricDefinition, resourceName);
      return (
        `${baseUrl}${urlPrefix}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}` +
        `&metricnamespace=${encodeURIComponent(metricNamespace)}`
      );
    }
  }
}
