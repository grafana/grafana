export default class UrlBuilder {
  static buildAzureMonitorGetMetricNamespacesUrl(
    baseUrl: string,
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    apiVersion: string
  ) {
    if ((metricDefinition.match(/\//g) || []).length > 1) {
      const rn = resourceName.split('/');
      const service = metricDefinition.substring(metricDefinition.lastIndexOf('/') + 1);
      const md = metricDefinition.substring(0, metricDefinition.lastIndexOf('/'));
      return (
        `${baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${md}/${rn[0]}/${service}/${rn[1]}` +
        `/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`
      );
    }

    return (
      `${baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${metricDefinition}/${resourceName}` +
      `/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}`
    );
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
    if ((metricDefinition.match(/\//g) || []).length > 1) {
      const rn = resourceName.split('/');
      const service = metricDefinition.substring(metricDefinition.lastIndexOf('/') + 1);
      const md = metricDefinition.substring(0, metricDefinition.lastIndexOf('/'));
      return (
        `${baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${md}/${rn[0]}/${service}/${rn[1]}` +
        `/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}&metricnamespace=${encodeURIComponent(
          metricNamespace
        )}`
      );
    }

    return (
      `${baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${metricDefinition}/${resourceName}` +
      `/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}&metricnamespace=${encodeURIComponent(
        metricNamespace
      )}`
    );
  }
}
