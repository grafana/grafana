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
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    apiVersion: string
  ) {
    const urlPrefix = UrlBuilder.buildResourceUri(subscriptionId, resourceGroup, metricDefinition, resourceName);
    return `${baseUrl}${urlPrefix}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`;
  }

  static buildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string,
    apiVersion: string
  ) {
    const urlPrefix = UrlBuilder.buildResourceUri(subscriptionId, resourceGroup, metricDefinition, resourceName);
    return (
      `${baseUrl}${urlPrefix}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}` +
      `&metricnamespace=${encodeURIComponent(metricNamespace)}`
    );
  }

  static newBuildAzureMonitorGetMetricNamespacesUrl(baseUrl: string, resourceUri: string, apiVersion: string) {
    return `${baseUrl}${resourceUri}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`;
  }

  static newBuildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
    resourceUri: string,
    metricNamespace: string,
    apiVersion: string
  ) {
    return (
      `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}` +
      `&metricnamespace=${encodeURIComponent(metricNamespace)}`
    );
  }
}
