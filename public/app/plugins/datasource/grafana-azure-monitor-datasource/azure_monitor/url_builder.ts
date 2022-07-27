import { TemplateSrv } from '@grafana/runtime';

import { GetMetricNamespacesQuery, GetMetricNamesQuery } from '../types';

export default class UrlBuilder {
  static buildResourceUri(
    subscriptionId: string,
    resourceGroup: string,
    templateSrv: TemplateSrv,
    metricNamespace?: string,
    resourceName?: string
  ) {
    const urlArray = ['/subscriptions', subscriptionId, 'resourceGroups', resourceGroup];

    if (metricNamespace && resourceName) {
      const metricNamespaceProcessed = templateSrv.replace(metricNamespace);
      const metricNamespaceArray = metricNamespace.split('/');
      const resourceNameProcessed = templateSrv.replace(resourceName);
      const resourceNameArray = resourceName.split('/');
      const provider = metricNamespaceArray.shift();
      if (provider) {
        urlArray.push('providers', provider);
      }

      if (
        metricNamespaceProcessed.startsWith('Microsoft.Storage/storageAccounts/') &&
        !resourceNameProcessed.endsWith('default')
      ) {
        resourceNameArray.push('default');
      }

      if (resourceNameArray.length > metricNamespaceArray.length) {
        const parentResource = resourceNameArray.shift();
        if (parentResource) {
          urlArray.push(parentResource);
        }
      }

      for (const i in metricNamespaceArray) {
        urlArray.push(metricNamespaceArray[i]);
        urlArray.push(resourceNameArray[i]);
      }
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
      const { subscription, resourceGroup, metricNamespace, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(
        subscription,
        resourceGroup,
        templateSrv,
        metricNamespace,
        resourceName
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
      const { subscription, resourceGroup, metricNamespace, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(
        subscription,
        resourceGroup,
        templateSrv,
        metricNamespace,
        resourceName
      );
    }

    let url = `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}`;
    if (metricNamespace) {
      url += `&metricnamespace=${encodeURIComponent(metricNamespace)}`;
    }
    return url;
  }
}
