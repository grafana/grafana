import { type TimeRange } from '@grafana/data';
import { type TemplateSrv } from '@grafana/runtime';

import { type AzureMonitorResource } from '../dataquery.gen';
import { type GetDimensionValuesQuery, type GetMetricNamespacesQuery, type GetMetricNamesQuery } from '../types/types';

export default class UrlBuilder {
  static buildResourceUri(templateSrv: TemplateSrv, resource: AzureMonitorResource, multipleResources?: boolean) {
    const urlArray = [];
    const { subscription, resourceGroup, metricNamespace, resourceName } = resource;
    if (subscription) {
      urlArray.push('/subscriptions', subscription);
      if (resourceGroup && !multipleResources) {
        urlArray.push('resourceGroups', resourceGroup);

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
            metricNamespaceProcessed.toLowerCase().startsWith('microsoft.storage/storageaccounts/') &&
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
      }
    }

    return urlArray.join('/');
  }

  static buildAzureMonitorGetMetricNamespacesUrl(
    baseUrl: string,
    apiVersion: string,
    query: GetMetricNamespacesQuery,
    globalRegion: boolean,
    templateSrv: TemplateSrv,
    region?: string
  ) {
    let resourceUri: string;

    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricNamespace, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(templateSrv, {
        subscription,
        resourceGroup,
        metricNamespace,
        resourceName,
      });
    }

    return `${baseUrl}${resourceUri}/providers/microsoft.insights/metricNamespaces?api-version=${apiVersion}${
      region ? `&region=${region}` : globalRegion ? '&region=global' : ''
    }`;
  }

  static buildAzureMonitorGetMetricNamesUrl(
    baseUrl: string,
    apiVersion: string,
    query: GetMetricNamesQuery,
    templateSrv: TemplateSrv,
    multipleResources?: boolean,
    region?: string,
    batchAPIEnabled?: boolean
  ) {
    let resourceUri: string;
    // The subscription-level metricdefinitions API is not used when the batch API is enabled,
    // as the batch API handles multi-resource queries via regional endpoints.
    if (batchAPIEnabled) {
      multipleResources = false;
    }
    const { customNamespace, metricNamespace } = query;
    if ('resourceUri' in query) {
      resourceUri = query.resourceUri;
    } else {
      const { subscription, resourceGroup, metricNamespace, resourceName } = query;
      resourceUri = UrlBuilder.buildResourceUri(
        templateSrv,
        {
          subscription,
          resourceGroup,
          metricNamespace,
          resourceName,
        },
        multipleResources
      );
    }
    let url = `${baseUrl}${resourceUri}/providers/microsoft.insights/metricdefinitions?api-version=${apiVersion}`;
    if (customNamespace) {
      url += `&metricnamespace=${encodeURIComponent(customNamespace)}`;
    }

    if (multipleResources && !customNamespace && metricNamespace) {
      url += `&metricnamespace=${encodeURIComponent(metricNamespace)}`;
    }

    if (region && multipleResources) {
      url += `&region=${region}`;
    }

    return url;
  }

  static buildAzureMonitorGetLogsTableUrl(
    baseUrl: string,
    resourceUri: string,
    tableName: string,
    apiVersion = '2025-02-01'
  ) {
    return `${baseUrl}${resourceUri}/tables/${tableName}?api-version=${apiVersion}`;
  }

  static buildAzureMonitorGetDimensionValuesUrl(
    baseUrl: string,
    apiVersion: string,
    query: GetDimensionValuesQuery,
    range: TimeRange,
    templateSrv: TemplateSrv
  ) {
    const resourceUri = UrlBuilder.buildResourceUri(templateSrv, {
      subscription: query.subscription,
      resourceGroup: query.resourceGroup,
      metricNamespace: query.metricNamespace,
      resourceName: query.resourceName,
    });
    const searchParams = new URLSearchParams();
    searchParams.set('api-version', apiVersion);
    searchParams.set('timespan', `${range.from.toISOString()}/${range.to.toISOString()}`);
    searchParams.set('metricnames', query.metricName);
    searchParams.set('metricnamespace', query.customNamespace || query.metricNamespace);
    searchParams.set('resultType', 'metadata');
    // Azure requires at least one dimension under eq for resultType=metadata.
    searchParams.set('$filter', `${query.dimension.trim()} eq '*'`);
    searchParams.set('top', '1000');
    return `${baseUrl}${resourceUri}/providers/microsoft.insights/metrics?${searchParams}`;
  }
}
