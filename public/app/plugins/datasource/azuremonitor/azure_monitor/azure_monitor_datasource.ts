import { find, startsWith } from 'lodash';

import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';

import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import TimegrainConverter from '../time_grain_converter';
import {
  AzureDataSourceJsonData,
  AzureMonitorMetricNamespacesResponse,
  AzureMonitorMetricNamesResponse,
  AzureMonitorMetricsMetadataResponse,
  AzureMonitorQuery,
  AzureMonitorResourceGroupsResponse,
  AzureQueryType,
  DatasourceValidationResult,
  GetMetricNamespacesQuery,
  GetMetricNamesQuery,
  GetMetricMetadataQuery,
  AzureMetricQuery,
  AzureMonitorLocations,
  AzureMonitorProvidersResponse,
  AzureAPIResponse,
  AzureGetResourceNamesQuery,
  Subscription,
  Location,
} from '../types';
import { routeNames } from '../utils/common';
import migrateQuery from '../utils/migrateQuery';

import ResponseParser from './response_parser';
import UrlBuilder from './url_builder';

const defaultDropdownValue = 'select';

function hasValue(item?: string) {
  return !!(item && item !== defaultDropdownValue);
}

export default class AzureMonitorDatasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  listByResourceGroupApiVersion = '2021-04-01';
  providerApiVersion = '2021-04-01';
  locationsApiVersion = '2020-01-01';
  defaultSubscriptionId?: string;
  resourcePath: string;
  azurePortalUrl: string;
  declare resourceGroup: string;
  declare resourceName: string;
  timeSrv: TimeSrv;
  templateSrv: TemplateSrv;

  constructor(private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);

    this.timeSrv = getTimeSrv();
    this.templateSrv = getTemplateSrv();
    this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;

    const cloud = getAzureCloud(instanceSettings);
    this.resourcePath = routeNames.azureMonitor;
    this.azurePortalUrl = getAzurePortalUrl(cloud);
  }

  isConfigured(): boolean {
    // If validation didn't return any error then the data source is properly configured
    return !this.validateDatasource();
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    const hasResource =
      item?.azureMonitor?.resources &&
      item.azureMonitor.resources.length > 0 &&
      item.azureMonitor.resources.every((r) => hasValue(r.resourceGroup) && hasValue(r.resourceName)) &&
      hasValue(item?.azureMonitor?.metricDefinition || item?.azureMonitor?.metricNamespace);
    const hasResourceUri = hasValue(item.azureMonitor?.resourceUri);

    return !!(
      item.hide !== true &&
      (hasResource || hasResourceUri) &&
      hasValue(item?.azureMonitor?.metricName) &&
      hasValue(item?.azureMonitor?.aggregation)
    );
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const item = target.azureMonitor;

    if (!item) {
      // return target;
      throw new Error('Query is not a valid Azure Monitor Metrics query');
    }

    // fix for timeGrainUnit which is a deprecated/removed field name
    if (item.timeGrain && item.timeGrainUnit && item.timeGrain !== 'auto') {
      item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
    }

    const templateSrv = getTemplateSrv();

    const subscriptionId = templateSrv.replace(target.subscription || this.defaultSubscriptionId, scopedVars);
    const resources = item.resources?.map((r) => this.replaceTemplateVariables(r, scopedVars)).flat();
    const metricNamespace = templateSrv.replace(item.metricNamespace, scopedVars);
    const customNamespace = templateSrv.replace(item.customNamespace, scopedVars);
    const timeGrain = templateSrv.replace((item.timeGrain || '').toString(), scopedVars);
    const aggregation = templateSrv.replace(item.aggregation, scopedVars);
    const top = templateSrv.replace(item.top || '', scopedVars);

    const dimensionFilters = (item.dimensionFilters ?? [])
      .filter((f) => f.dimension && f.dimension !== 'None')
      .map((f) => {
        const filters = f.filters?.map((filter) => templateSrv.replace(filter ?? '', scopedVars));
        return {
          dimension: templateSrv.replace(f.dimension, scopedVars),
          operator: f.operator || 'eq',
          filters: filters || [],
        };
      });

    const azMonitorQuery: AzureMetricQuery = {
      ...item,
      resources,
      metricNamespace,
      customNamespace,
      timeGrain,
      allowedTimeGrainsMs: item.allowedTimeGrainsMs,
      metricName: templateSrv.replace(item.metricName, scopedVars),
      region: templateSrv.replace(item.region, scopedVars),
      aggregation: aggregation,
      dimensionFilters,
      top: top || '10',
      alias: item.alias,
    };
    if (item.metricDefinition) {
      azMonitorQuery.metricDefinition = templateSrv.replace(item.metricDefinition, scopedVars);
    }
    if (item.resourceUri) {
      azMonitorQuery.resourceUri = templateSrv.replace(item.resourceUri, scopedVars);
    }

    return migrateQuery({
      ...target,
      subscription: subscriptionId,
      queryType: AzureQueryType.AzureMonitor,
      azureMonitor: azMonitorQuery,
    });
  }

  async getSubscriptions(): Promise<Array<{ text: string; value: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    return this.getResource<AzureAPIResponse<Subscription>>(
      `${this.resourcePath}/subscriptions?api-version=2019-03-01`
    ).then((result) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  getResourceGroups(subscriptionId: string) {
    return this.getResource(
      `${this.resourcePath}/subscriptions/${subscriptionId}/resourceGroups?api-version=${this.listByResourceGroupApiVersion}`
    ).then((result: AzureMonitorResourceGroupsResponse) => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  async getResourceNames(query: AzureGetResourceNamesQuery, skipToken?: string) {
    const promises = this.replaceTemplateVariables(query).map(
      ({ metricNamespace, subscriptionId, resourceGroup, region }) => {
        const validMetricNamespace = startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')
          ? 'microsoft.storage/storageaccounts'
          : metricNamespace;
        let url = `${this.resourcePath}/subscriptions/${subscriptionId}`;
        if (resourceGroup) {
          url += `/resourceGroups/${resourceGroup}`;
        }
        url += `/resources?api-version=${this.listByResourceGroupApiVersion}`;
        const filters: string[] = [];
        if (validMetricNamespace) {
          filters.push(`resourceType eq '${validMetricNamespace}'`);
        }
        if (region) {
          filters.push(`location eq '${region}'`);
        }
        if (filters.length > 0) {
          url += `&$filter=${filters.join(' and ')}`;
        }
        if (skipToken) {
          url += `&$skiptoken=${skipToken}`;
        }
        return this.getResource(url).then(async (result: any) => {
          let list: Array<{ text: string; value: string }> = [];
          if (startsWith(metricNamespace?.toLowerCase(), 'microsoft.storage/storageaccounts/')) {
            list = ResponseParser.parseResourceNames(result, 'microsoft.storage/storageaccounts');
            for (let i = 0; i < list.length; i++) {
              list[i].text += '/default';
              list[i].value += '/default';
            }
          } else {
            list = ResponseParser.parseResourceNames(result, metricNamespace);
          }

          if (result.nextLink) {
            // If there is a nextLink, we should request more pages
            const nextURL = new URL(result.nextLink);
            const nextToken = nextURL.searchParams.get('$skiptoken');
            if (!nextToken) {
              throw Error('unable to request the next page of resources');
            }
            const nextPage = await this.getResourceNames({ metricNamespace, subscriptionId, resourceGroup }, nextToken);
            list = list.concat(nextPage);
          }

          return list;
        });
      }
    );
    return (await Promise.all(promises)).flat();
  }

  getMetricNamespaces(query: GetMetricNamespacesQuery, globalRegion: boolean) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
      this.resourcePath,
      this.apiPreviewVersion,
      // Only use the first query, as the metric namespaces should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      globalRegion,
      this.templateSrv
    );
    return this.getResource(url)
      .then((result: AzureMonitorMetricNamespacesResponse) => {
        return ResponseParser.parseResponseValues(
          result,
          'properties.metricNamespaceName',
          'properties.metricNamespaceName'
        );
      })
      .then((result) => {
        if (url.toLowerCase().includes('microsoft.storage/storageaccounts')) {
          const storageNamespaces = [
            'microsoft.storage/storageaccounts',
            'microsoft.storage/storageaccounts/blobservices',
            'microsoft.storage/storageaccounts/fileservices',
            'microsoft.storage/storageaccounts/tableservices',
            'microsoft.storage/storageaccounts/queueservices',
          ];
          for (const namespace of storageNamespaces) {
            if (!find(result, ['value', namespace.toLowerCase()])) {
              result.push({ value: namespace, text: namespace });
            }
          }
        }
        return result;
      });
  }

  getMetricNames(query: GetMetricNamesQuery) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      this.apiVersion,
      // Only use the first query, as the metric names should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      this.templateSrv
    );
    return this.getResource(url).then((result: AzureMonitorMetricNamesResponse) => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(query: GetMetricMetadataQuery) {
    const { metricName } = query;
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      this.apiVersion,
      // Only use the first query, as the metric metadata should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      this.templateSrv
    );
    return this.getResource(url).then((result: AzureMonitorMetricsMetadataResponse) => {
      return ResponseParser.parseMetadata(result, this.templateSrv.replace(metricName));
    });
  }

  private validateDatasource(): DatasourceValidationResult | undefined {
    const authType = getAuthType(this.instanceSettings);

    if (authType === 'clientsecret') {
      if (!this.isValidConfigField(this.instanceSettings.jsonData.tenantId)) {
        return {
          status: 'error',
          message: 'The Tenant Id field is required.',
        };
      }

      if (!this.isValidConfigField(this.instanceSettings.jsonData.clientId)) {
        return {
          status: 'error',
          message: 'The Client Id field is required.',
        };
      }
    }

    return undefined;
  }

  private isValidConfigField(field?: string): boolean {
    return typeof field === 'string' && field.length > 0;
  }

  private replaceSingleTemplateVariables<T extends { [K in keyof T]: string }>(query: T, scopedVars?: ScopedVars) {
    // This method evaluates template variables supporting multiple values but only returns the first value.
    // This will work as far as the the first combination of variables is valid.
    // For example if 'rg1' contains 'res1' and 'rg2' contains 'res2' then
    // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res1', 'res2'] } would return
    // { resourceGroup: 'rg1', resourceName: 'res1' } which is valid but
    // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res2'] } would result in
    // { resourceGroup: 'rg1', resourceName: 'res2' } which is not.
    return this.replaceTemplateVariables(query, scopedVars)[0];
  }

  private replaceTemplateVariables<T extends { [K in keyof T]: string }>(query: T, scopedVars?: ScopedVars) {
    const workingQueries: Array<{ [K in keyof T]: string }> = [{ ...query }];
    const keys = Object.keys(query) as Array<keyof T>;
    keys.forEach((key) => {
      const replaced = this.templateSrv.replace(workingQueries[0][key], scopedVars, 'raw');
      if (replaced.includes(',')) {
        const multiple = replaced.split(',');
        const currentQueries = [...workingQueries];
        multiple.forEach((value, i) => {
          currentQueries.forEach((q) => {
            if (i === 0) {
              q[key] = value;
            } else {
              workingQueries.push({ ...q, [key]: value });
            }
          });
        });
      } else {
        workingQueries.forEach((q) => {
          q[key] = replaced;
        });
      }
    });

    return workingQueries;
  }

  async getProvider(providerName: string) {
    return await this.getResource<AzureMonitorProvidersResponse>(
      `${routeNames.azureMonitor}/providers/${providerName}?api-version=${this.providerApiVersion}`
    );
  }

  async getLocations(subscriptions: string[]) {
    const locationMap = new Map<string, AzureMonitorLocations>();
    for (const subscription of subscriptions) {
      const subLocations = ResponseParser.parseLocations(
        await this.getResource<AzureAPIResponse<Location>>(
          `${routeNames.azureMonitor}/subscriptions/${this.templateSrv.replace(subscription)}/locations?api-version=${
            this.locationsApiVersion
          }`
        )
      );
      for (const location of subLocations) {
        locationMap.set(location.name, location);
      }
    }

    return locationMap;
  }
}
