import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { filter, startsWith } from 'lodash';

import { resourceTypeDisplayNames } from '../azureMetadata';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import TimegrainConverter from '../time_grain_converter';
import {
  AzureDataSourceJsonData,
  AzureMonitorMetricDefinitionsResponse,
  AzureMonitorQuery,
  AzureMonitorResourceGroupsResponse,
  AzureQueryType,
  DatasourceValidationResult,
} from '../types';
import { routeNames } from '../utils/common';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import UrlBuilder from './url_builder';

const defaultDropdownValue = 'select';

export default class AzureMonitorDatasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  listByResourceGroupApiVersion = '2021-04-01';
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
    this.resourcePath = `${routeNames.azureMonitor}/subscriptions`;
    this.supportedMetricNamespaces = new SupportedNamespaces(cloud).get();
    this.azurePortalUrl = getAzurePortalUrl(cloud);
  }

  isConfigured(): boolean {
    // If validation didn't return any error then the data source is properly configured
    return !this.validateDatasource();
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return !!(
      item.hide !== true &&
      item.azureMonitor &&
      item.azureMonitor.resourceGroup &&
      item.azureMonitor.resourceGroup !== defaultDropdownValue &&
      item.azureMonitor.resourceName &&
      item.azureMonitor.resourceName !== defaultDropdownValue &&
      item.azureMonitor.metricDefinition &&
      item.azureMonitor.metricDefinition !== defaultDropdownValue &&
      item.azureMonitor.metricName &&
      item.azureMonitor.metricName !== defaultDropdownValue &&
      item.azureMonitor.aggregation &&
      item.azureMonitor.aggregation !== defaultDropdownValue
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

  async getSubscriptions(): Promise<Array<{ text: string; value: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    return this.getResource(`${this.resourcePath}?api-version=2019-03-01`).then((result: any) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  getResourceGroups(subscriptionId: string) {
    return this.getResource(
      `${this.resourcePath}/${subscriptionId}/resourceGroups?api-version=${this.listByResourceGroupApiVersion}`
    ).then((result: AzureMonitorResourceGroupsResponse) => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    return this.getResource(
      `${this.resourcePath}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${this.listByResourceGroupApiVersion}`
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
      `${this.resourcePath}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?$filter=resourceType eq '${metricDefinition}'&api-version=${this.listByResourceGroupApiVersion}`
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

  getMetricNamespaces(subscriptionId: string, resourceGroup: string, metricDefinition: string, resourceName: string) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
      this.resourcePath,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      this.apiPreviewVersion
    );

    return this.getResource(url).then((result: any) => {
      return ResponseParser.parseResponseValues(result, 'name', 'properties.metricNamespaceName');
    });
  }

  getMetricNames(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string
  ) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace,
      this.apiVersion
    );

    return this.getResource(url).then((result: any) => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string,
    metricName: string
  ) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace,
      this.apiVersion
    );

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
      const url = `${this.resourcePath}?api-version=2019-03-01`;

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
