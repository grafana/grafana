import { filter, startsWith } from 'lodash';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
import {
  AzureMonitorQuery,
  AzureDataSourceJsonData,
  AzureMonitorMetricDefinitionsResponse,
  AzureMonitorResourceGroupsResponse,
  AzureQueryType,
  DatasourceValidationResult,
} from '../types';
import { DataSourceInstanceSettings, ScopedVars, MetricFindValue } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import { resourceTypeDisplayNames } from '../azureMetadata';
import { routeNames } from '../utils/common';
import { createResourceURI } from '../utils/resourceURIUtils';

const defaultDropdownValue = 'select';

export default class AzureMonitorDatasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  defaultSubscriptionId?: string;
  resourcePath: string;
  azurePortalUrl: string;
  declare resourceGroup: string;
  declare resourceName: string;
  supportedMetricNamespaces: string[] = [];
  timeSrv: TimeSrv;

  constructor(private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);

    this.timeSrv = getTimeSrv();
    this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;

    const cloud = getAzureCloud(instanceSettings);
    this.resourcePath = routeNames.azureMonitor;
    this.supportedMetricNamespaces = new SupportedNamespaces(cloud).get();
    this.azurePortalUrl = getAzurePortalUrl(cloud);
  }

  isConfigured(): boolean {
    // If validation didn't return any error then the data source is properly configured
    return !this.validateDatasource();
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    // If it doesnt have a resource URI, check to see if it has the old individual resource fields
    var hasResource =
      item.azureMonitor?.resource ||
      (hasValue(item.azureMonitor?.resourceGroup) &&
        hasValue(item.azureMonitor?.resourceName) &&
        hasValue(item.azureMonitor?.metricDefinition));

    const result = !!(
      item.hide !== true &&
      item.azureMonitor &&
      hasResource &&
      hasValue(item.azureMonitor.metricName) &&
      hasValue(item.azureMonitor.aggregation)
    );

    console.log('filterQuery', item, { result, hasResource });

    return result;
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

    const resourceURI = templateSrv.replace(item.resource, scopedVars);
    const subscriptionId = templateSrv.replace(target.subscription || this.defaultSubscriptionId, scopedVars);
    const resourceGroup = templateSrv.replace(item.resourceGroup, scopedVars);
    const resourceName = templateSrv.replace(item.resourceName, scopedVars);
    const metricNamespace = templateSrv.replace(item.metricNamespace, scopedVars);
    const metricDefinition = templateSrv.replace(item.metricDefinition, scopedVars);
    const timeGrain = templateSrv.replace((item.timeGrain || '').toString(), scopedVars);
    const aggregation = templateSrv.replace(item.aggregation, scopedVars);
    const top = templateSrv.replace(item.top || '', scopedVars);

    const dimensionFilters = (item.dimensionFilters ?? [])
      .filter((f) => f.dimension && f.dimension !== 'None')
      .map((f) => {
        const filter = templateSrv.replace(f.filter ?? '', scopedVars);
        return {
          dimension: templateSrv.replace(f.dimension, scopedVars),
          operator: f.operator || 'eq',
          filter: filter || '*', // send * when empty
        };
      });

    return {
      refId: target.refId,
      subscription: subscriptionId,
      queryType: AzureQueryType.AzureMonitor,
      azureMonitor: {
        resource: resourceURI,
        resourceGroup,
        resourceName,
        metricDefinition,
        timeGrain,
        allowedTimeGrainsMs: item.allowedTimeGrainsMs,
        metricName: templateSrv.replace(item.metricName, scopedVars),
        metricNamespace:
          metricNamespace && metricNamespace !== defaultDropdownValue ? metricNamespace : metricDefinition,
        aggregation: aggregation,
        dimensionFilters,
        top: top || '10',
        alias: item.alias,
      },
    };
  }

  /**
   * This is named differently than DataSourceApi.metricFindQuery
   * because it's not exposed to Grafana like the main AzureMonitorDataSource.
   * And some of the azure internal data sources return null in this function, which the
   * external interface does not support
   */
  metricFindQueryInternal(query: string): Promise<MetricFindValue[]> | null {
    const subscriptionsQuery = query.match(/^Subscriptions\(\)/i);
    if (subscriptionsQuery) {
      return this.getSubscriptions();
    }

    const resourceGroupsQuery = query.match(/^ResourceGroups\(\)/i);
    if (resourceGroupsQuery && this.defaultSubscriptionId) {
      return this.getResourceGroups(this.defaultSubscriptionId);
    }

    const resourceGroupsQueryWithSub = query.match(/^ResourceGroups\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (resourceGroupsQueryWithSub) {
      return this.getResourceGroups(this.toVariable(resourceGroupsQueryWithSub[1]));
    }

    const metricDefinitionsQuery = query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (metricDefinitionsQuery && this.defaultSubscriptionId) {
      if (!metricDefinitionsQuery[3]) {
        return this.getMetricDefinitions(this.defaultSubscriptionId, this.toVariable(metricDefinitionsQuery[1]));
      }
    }

    const metricDefinitionsQueryWithSub = query.match(/^Namespaces\(([^,]+?),\s?([^,]+?)\)/i);
    if (metricDefinitionsQueryWithSub) {
      return this.getMetricDefinitions(
        this.toVariable(metricDefinitionsQueryWithSub[1]),
        this.toVariable(metricDefinitionsQueryWithSub[2])
      );
    }

    const resourceNamesQuery = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?)\)/i);
    if (resourceNamesQuery && this.defaultSubscriptionId) {
      const resourceGroup = this.toVariable(resourceNamesQuery[1]);
      const metricDefinition = this.toVariable(resourceNamesQuery[2]);
      return this.getResourceNames(this.defaultSubscriptionId, resourceGroup, metricDefinition);
    }

    const resourceNamesQueryWithSub = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);
    if (resourceNamesQueryWithSub) {
      const subscription = this.toVariable(resourceNamesQueryWithSub[1]);
      const resourceGroup = this.toVariable(resourceNamesQueryWithSub[2]);
      const metricDefinition = this.toVariable(resourceNamesQueryWithSub[3]);
      return this.getResourceNames(subscription, resourceGroup, metricDefinition);
    }

    const metricNamespaceQuery = query.match(/^MetricNamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
    if (metricNamespaceQuery && this.defaultSubscriptionId) {
      const resourceGroup = this.toVariable(metricNamespaceQuery[1]);
      const resourceType = this.toVariable(metricNamespaceQuery[2]);
      const resource = this.toVariable(metricNamespaceQuery[3]);
      // TODO: recreate a resource URI

      const resourceURI = createResourceURI({
        subscriptionID: this.defaultSubscriptionId,
        resourceGroup,
        resourceType,
        resource,
      });

      return this.getMetricNamespaces(resourceURI);
    }

    const metricNamespaceQueryWithSub = query.match(
      /^metricnamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i
    );
    if (metricNamespaceQueryWithSub) {
      const subscriptionID = this.toVariable(metricNamespaceQueryWithSub[1]);
      const resourceGroup = this.toVariable(metricNamespaceQueryWithSub[2]);
      const resourceType = this.toVariable(metricNamespaceQueryWithSub[3]);
      const resource = this.toVariable(metricNamespaceQueryWithSub[4]);
      // TODO: recreate a resource URI

      const resourceURI = createResourceURI({
        subscriptionID,
        resourceGroup,
        resourceType,
        resource,
      });

      return this.getMetricNamespaces(resourceURI);
    }

    const metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
    if (metricNamesQuery && this.defaultSubscriptionId) {
      if (metricNamesQuery[3].indexOf(',') === -1) {
        const resourceGroup = this.toVariable(metricNamesQuery[1]);
        const resourceType = this.toVariable(metricNamesQuery[2]);
        const resource = this.toVariable(metricNamesQuery[3]);
        const metricNamespace = this.toVariable(metricNamesQuery[4]);

        const resourceURI = createResourceURI({
          subscriptionID: this.defaultSubscriptionId,
          resourceGroup,
          resourceType,
          resource,
        });

        return this.getMetricNames(resourceURI, metricNamespace);
      }
    }

    const metricNamesQueryWithSub = query.match(
      /^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?(.+?)\)/i
    );

    if (metricNamesQueryWithSub) {
      const subscriptionID = this.toVariable(metricNamesQueryWithSub[1]);
      const resourceGroup = this.toVariable(metricNamesQueryWithSub[2]);
      const resourceType = this.toVariable(metricNamesQueryWithSub[3]);
      const resource = this.toVariable(metricNamesQueryWithSub[4]);
      const metricNamespace = this.toVariable(metricNamesQueryWithSub[5]);

      const resourceURI = createResourceURI({
        subscriptionID: subscriptionID,
        resourceGroup,
        resourceType,
        resource,
      });
      return this.getMetricNames(resourceURI, metricNamespace);
    }

    return null;
  }

  toVariable(metric: string) {
    return getTemplateSrv().replace((metric || '').trim());
  }

  async getSubscriptions(): Promise<Array<{ text: string; value: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    return this.getResource(`${this.resourcePath}/subscriptions?api-version=2019-03-01`).then((result: any) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  getResourceGroups(subscriptionId: string) {
    return this.getResource(
      `${this.resourcePath}/subscriptions/${subscriptionId}/resourceGroups?api-version=${this.apiVersion}`
    ).then((result: AzureMonitorResourceGroupsResponse) => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    return this.getResource(
      `${this.resourcePath}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${this.apiVersion}`
    )
      .then((result: AzureMonitorMetricDefinitionsResponse) => {
        return ResponseParser.parseResponseValues(result, 'type', 'type');
      })
      .then((result) => {
        return filter(result, (t) => {
          for (let i = 0; i < this.supportedMetricNamespaces.length; i++) {
            if (t.value.toLowerCase() === this.supportedMetricNamespaces[i].toLowerCase()) {
              return true;
            }
          }

          return false;
        });
      })
      .then((result) => {
        let shouldHardcodeBlobStorage = false;
        for (let i = 0; i < result.length; i++) {
          if (result[i].value === 'Microsoft.Storage/storageAccounts') {
            shouldHardcodeBlobStorage = true;
            break;
          }
        }

        if (shouldHardcodeBlobStorage) {
          result.push({
            text: 'Microsoft.Storage/storageAccounts/blobServices',
            value: 'Microsoft.Storage/storageAccounts/blobServices',
          });
          result.push({
            text: 'Microsoft.Storage/storageAccounts/fileServices',
            value: 'Microsoft.Storage/storageAccounts/fileServices',
          });
          result.push({
            text: 'Microsoft.Storage/storageAccounts/tableServices',
            value: 'Microsoft.Storage/storageAccounts/tableServices',
          });
          result.push({
            text: 'Microsoft.Storage/storageAccounts/queueServices',
            value: 'Microsoft.Storage/storageAccounts/queueServices',
          });
        }

        return result.map((v) => ({
          value: v.value,
          text: resourceTypeDisplayNames[v.value.toLowerCase()] || v.value,
        }));
      });
  }

  getResourceNames(subscriptionId: string, resourceGroup: string, metricDefinition: string) {
    return this.getResource(
      `${this.resourcePath}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${this.apiVersion}`
    ).then((result: any) => {
      if (!startsWith(metricDefinition, 'Microsoft.Storage/storageAccounts/')) {
        return ResponseParser.parseResourceNames(result, metricDefinition);
      }

      const list = ResponseParser.parseResourceNames(result, 'Microsoft.Storage/storageAccounts');
      for (let i = 0; i < list.length; i++) {
        list[i].text += '/default';
        list[i].value += '/default';
      }

      return list;
    });
  }

  getMetricNamespaces(resourceURI: string) {
    const url = `${this.resourcePath}${resourceURI}/providers/microsoft.insights/metricNamespaces?api-version=${this.apiPreviewVersion}`;

    console.log('getMetricNamespaces', url);
    return this.getResource(url).then((result: any) => {
      return ResponseParser.parseResponseValues(result, 'name', 'properties.metricNamespaceName');
    });
  }

  getMetricNames(resourceURI: string, metricNamespace: string) {
    const url = `${this.resourcePath}${resourceURI}/providers/microsoft.insights/metricDefinitions?api-version=${
      this.apiPreviewVersion
    }&metricnamespace=${encodeURIComponent(metricNamespace)}`;

    return this.getResource(url).then((result: any) => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(resourceURI: string, metricNamespace: string, metricName: string) {
    const url = `${this.resourcePath}${resourceURI}/providers/microsoft.insights/metricDefinitions?api-version=${
      this.apiPreviewVersion
    }&metricnamespace=${encodeURIComponent(metricNamespace)}`;

    return this.getResource(url).then((result: any) => {
      return ResponseParser.parseMetadata(result, metricName);
    });
  }

  async testDatasource(): Promise<DatasourceValidationResult> {
    const validationError = this.validateDatasource();
    if (validationError) {
      return Promise.resolve(validationError);
    }

    try {
      const url = `${this.resourcePath}/subscriptions?api-version=2019-03-01`;

      return await this.getResource(url).then<DatasourceValidationResult>((response: any) => {
        return {
          status: 'success',
          message: 'Successfully queried the Azure Monitor service.',
          title: 'Success',
        };
      });
    } catch (e) {
      let message = 'Azure Monitor: ';
      message += e.statusText ? e.statusText + ': ' : '';

      if (e.data && e.data.error && e.data.error.code) {
        message += e.data.error.code + '. ' + e.data.error.message;
      } else if (e.data && e.data.error) {
        message += e.data.error;
      } else if (e.data) {
        message += e.data;
      } else {
        message += 'Cannot connect to Azure Monitor REST API.';
      }
      return {
        status: 'error',
        message: message,
      };
    }
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
}

function hasValue(value: string | undefined): boolean {
  return !!value && value !== defaultDropdownValue;
}

function stringifyAzurePortalUrlParam(value: string | object): string {
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  return encodeURIComponent(stringValue);
}

// Used to convert our aggregation value to the Azure enum for deep linking
const aggregationTypeMap: Record<string, number> = {
  None: 0,
  Total: 1,
  Minimum: 2,
  Maximum: 3,
  Average: 4,
  Count: 7,
};
