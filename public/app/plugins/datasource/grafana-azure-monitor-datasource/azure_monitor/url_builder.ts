import { TemplateSrv } from '@grafana/runtime';

import { GetMetricNamespacesQuery, GetMetricNamesQuery } from '../types';

export default class UrlBuilder {
  static buildResourceUri(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    templateSrv: TemplateSrv
  ) {
    const metricDefinitionProcessed = templateSrv.replace(metricDefinition);
    const metricDefinitionArray = metricDefinition.split('/');
    const resourceNameProcessed = templateSrv.replace(resourceName);
    const resourceNameArray = resourceName.split('/');
    const provider = metricDefinitionArray.shift();
    const urlArray = ['/subscriptions', subscriptionId, 'resourceGroups', resourceGroup, 'providers', provider];

    if (
      metricDefinitionProcessed.startsWith('Microsoft.Storage/storageAccounts/') &&
      !resourceNameProcessed.endsWith('default')
    ) {
      resourceNameArray.push('default');
    }

    if (resourceNameArray.length > metricDefinitionArray.length) {
      const parentResource = resourceNameArray.shift();
      urlArray.push(parentResource);
    }

    for (const i in metricDefinitionArray) {
      urlArray.push(metricDefinitionArray[i]);
      urlArray.push(resourceNameArray[i]);
    }
    return urlArray.join('/');
  }

  static buildAzureMonitorGetMetricNamespacesUrl(
    baseUrl: string,
    apiVersion: string,
    query: GetMetricNamespacesQuery,
    templateSrv: TemplateSrv
  ) {
    let resourceUri: string;

    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        templateSrv
      );
    }

    return `${baseUrl}${resourceUri}/providers/microsoft.insights/metricNamespaces?region=global&api-version=${apiVersion}`;
  }

  static buildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
    apiVersion: string,
    query: GetMetricNamesQuery,
    templateSrv: TemplateSrv
  ) {
    let resourceUri: string;
    const { metricNamespace } = query;

    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricDefinition, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        templateSrv
      );
    }

    let url = `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}`;
    if (metricNamespace) {
      url += `&metricnamespace=${encodeURIComponent(metricNamespace)}`;
    }
    return url;
  }
}
