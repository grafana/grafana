export default class UrlBuilder {
  static buildAzureMonitorQueryUrl(
    baseUrl: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    apiVersion: string,
    filter: string
  ) {
    if ((metricDefinition.match(/\//g) || []).length > 1) {
      const rn = resourceName.split('/');
      const service = metricDefinition.substring(metricDefinition.lastIndexOf('/') + 1);
      const md = metricDefinition.substring(0, metricDefinition.lastIndexOf('/'));
      return (
        `${baseUrl}/${resourceGroup}/providers/${md}/${rn[0]}/${service}/${rn[1]}` +
        `/providers/microsoft.insights/metrics?api-version=${apiVersion}&${filter}`
      );
    }

    return (
      `${baseUrl}/${resourceGroup}/providers/${metricDefinition}/${resourceName}` +
      `/providers/microsoft.insights/metrics?api-version=${apiVersion}&${filter}`
    );
  }

  static buildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
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
        `${baseUrl}/${resourceGroup}/providers/${md}/${rn[0]}/${service}/${rn[1]}` +
        `/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}`
      );
    }

    return (
      `${baseUrl}/${resourceGroup}/providers/${metricDefinition}/${resourceName}` +
      `/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}`
    );
  }
}
