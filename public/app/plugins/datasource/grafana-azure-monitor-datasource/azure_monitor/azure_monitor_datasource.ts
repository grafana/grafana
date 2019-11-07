import _ from 'lodash';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
import {
  AzureMonitorQuery,
  AzureDataSourceJsonData,
  AzureMonitorMetricDefinitionsResponse,
  AzureMonitorResourceGroupsResponse,
} from '../types';
import { DataQueryRequest, DataQueryResponseData, DataSourceInstanceSettings } from '@grafana/data';

import { TimeSeries, toDataFrame } from '@grafana/data';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

export default class AzureMonitorDatasource {
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  id: number;
  subscriptionId: string;
  baseUrl: string;
  resourceGroup: string;
  resourceName: string;
  url: string;
  defaultDropdownValue = 'select';
  cloudName: string;
  supportedMetricNamespaces: string[] = [];

  /** @ngInject */
  constructor(
    private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    this.id = instanceSettings.id;
    this.subscriptionId = instanceSettings.jsonData.subscriptionId;
    this.cloudName = instanceSettings.jsonData.cloudName || 'azuremonitor';
    this.baseUrl = `/${this.cloudName}/subscriptions`;
    this.url = instanceSettings.url;

    this.supportedMetricNamespaces = new SupportedNamespaces(this.cloudName).get();
  }

  isConfigured(): boolean {
    return !!this.subscriptionId && this.subscriptionId.length > 0;
  }

  async query(options: DataQueryRequest<AzureMonitorQuery>): Promise<DataQueryResponseData[]> {
    const queries = _.filter(options.targets, item => {
      return (
        item.hide !== true &&
        item.azureMonitor.resourceGroup &&
        item.azureMonitor.resourceGroup !== this.defaultDropdownValue &&
        item.azureMonitor.resourceName &&
        item.azureMonitor.resourceName !== this.defaultDropdownValue &&
        item.azureMonitor.metricDefinition &&
        item.azureMonitor.metricDefinition !== this.defaultDropdownValue &&
        item.azureMonitor.metricName &&
        item.azureMonitor.metricName !== this.defaultDropdownValue
      );
    }).map(target => {
      const item = target.azureMonitor;

      // fix for timeGrainUnit which is a deprecated/removed field name
      if (item.timeGrainUnit && item.timeGrain !== 'auto') {
        item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
      }

      const subscriptionId = this.templateSrv.replace(target.subscription || this.subscriptionId, options.scopedVars);
      const resourceGroup = this.templateSrv.replace(item.resourceGroup, options.scopedVars);
      const resourceName = this.templateSrv.replace(item.resourceName, options.scopedVars);
      const metricNamespace = this.templateSrv.replace(item.metricNamespace, options.scopedVars);
      const metricDefinition = this.templateSrv.replace(item.metricDefinition, options.scopedVars);
      const timeGrain = this.templateSrv.replace((item.timeGrain || '').toString(), options.scopedVars);
      const aggregation = this.templateSrv.replace(item.aggregation, options.scopedVars);
      const top = this.templateSrv.replace(item.top || '', options.scopedVars);

      return {
        refId: target.refId,
        intervalMs: options.intervalMs,
        datasourceId: this.id,
        subscription: subscriptionId,
        queryType: 'Azure Monitor',
        type: 'timeSeriesQuery',
        raw: false,
        azureMonitor: {
          resourceGroup: resourceGroup,
          resourceName: resourceName,
          metricDefinition: metricDefinition,
          timeGrain: timeGrain,
          allowedTimeGrainsMs: item.allowedTimeGrainsMs,
          metricName: this.templateSrv.replace(item.metricName, options.scopedVars),
          metricNamespace:
            metricNamespace && metricNamespace !== this.defaultDropdownValue ? metricNamespace : metricDefinition,
          aggregation: aggregation,
          dimension: this.templateSrv.replace(item.dimension, options.scopedVars),
          top: top || '10',
          dimensionFilter: this.templateSrv.replace(item.dimensionFilter, options.scopedVars),
          alias: item.alias,
          format: target.format,
        },
      };
    });

    if (!queries || queries.length === 0) {
      return Promise.resolve([]);
    }

    const { data } = await this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: {
        from: options.range.from.valueOf().toString(),
        to: options.range.to.valueOf().toString(),
        queries,
      },
    });

    const result: DataQueryResponseData[] = [];
    if (data.results) {
      Object['values'](data.results).forEach((queryRes: any) => {
        if (!queryRes.series) {
          return;
        }
        queryRes.series.forEach((series: any) => {
          const timeSerie: TimeSeries = {
            target: series.name,
            datapoints: series.points,
            refId: queryRes.refId,
            meta: queryRes.meta,
          };
          result.push(toDataFrame(timeSerie));
        });
      });
      return result;
    }

    return Promise.resolve([]);
  }

  annotationQuery(options: any) {}

  metricFindQuery(query: string) {
    const subscriptionsQuery = query.match(/^Subscriptions\(\)/i);
    if (subscriptionsQuery) {
      return this.getSubscriptions();
    }

    const resourceGroupsQuery = query.match(/^ResourceGroups\(\)/i);
    if (resourceGroupsQuery) {
      return this.getResourceGroups(this.subscriptionId);
    }

    const resourceGroupsQueryWithSub = query.match(/^ResourceGroups\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (resourceGroupsQueryWithSub) {
      return this.getResourceGroups(this.toVariable(resourceGroupsQueryWithSub[1]));
    }

    const metricDefinitionsQuery = query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (metricDefinitionsQuery) {
      if (!metricDefinitionsQuery[3]) {
        return this.getMetricDefinitions(this.subscriptionId, this.toVariable(metricDefinitionsQuery[1]));
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
    if (resourceNamesQuery) {
      const resourceGroup = this.toVariable(resourceNamesQuery[1]);
      const metricDefinition = this.toVariable(resourceNamesQuery[2]);
      return this.getResourceNames(this.subscriptionId, resourceGroup, metricDefinition);
    }

    const resourceNamesQueryWithSub = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);
    if (resourceNamesQueryWithSub) {
      const subscription = this.toVariable(resourceNamesQueryWithSub[1]);
      const resourceGroup = this.toVariable(resourceNamesQueryWithSub[2]);
      const metricDefinition = this.toVariable(resourceNamesQueryWithSub[3]);
      return this.getResourceNames(subscription, resourceGroup, metricDefinition);
    }

    const metricNamespaceQuery = query.match(/^MetricNamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
    if (metricNamespaceQuery) {
      const resourceGroup = this.toVariable(metricNamespaceQuery[1]);
      const metricDefinition = this.toVariable(metricNamespaceQuery[2]);
      const resourceName = this.toVariable(metricNamespaceQuery[3]);
      return this.getMetricNamespaces(this.subscriptionId, resourceGroup, metricDefinition, resourceName);
    }

    const metricNamespaceQueryWithSub = query.match(
      /^metricnamespace\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i
    );
    if (metricNamespaceQueryWithSub) {
      const subscription = this.toVariable(metricNamespaceQueryWithSub[1]);
      const resourceGroup = this.toVariable(metricNamespaceQueryWithSub[2]);
      const metricDefinition = this.toVariable(metricNamespaceQueryWithSub[3]);
      const resourceName = this.toVariable(metricNamespaceQueryWithSub[4]);
      return this.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName);
    }

    const metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?)\)/i);
    if (metricNamesQuery) {
      if (metricNamesQuery[3].indexOf(',') === -1) {
        const resourceGroup = this.toVariable(metricNamesQuery[1]);
        const metricDefinition = this.toVariable(metricNamesQuery[2]);
        const resourceName = this.toVariable(metricNamesQuery[3]);
        const metricNamespace = this.toVariable(metricNamesQuery[4]);
        return this.getMetricNames(this.subscriptionId, resourceGroup, metricDefinition, resourceName, metricNamespace);
      }
    }

    const metricNamesQueryWithSub = query.match(
      /^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?(.+?)\)/i
    );

    if (metricNamesQueryWithSub) {
      const subscription = this.toVariable(metricNamesQueryWithSub[1]);
      const resourceGroup = this.toVariable(metricNamesQueryWithSub[2]);
      const metricDefinition = this.toVariable(metricNamesQueryWithSub[3]);
      const resourceName = this.toVariable(metricNamesQueryWithSub[4]);
      const metricNamespace = this.toVariable(metricNamesQueryWithSub[5]);
      return this.getMetricNames(subscription, resourceGroup, metricDefinition, resourceName, metricNamespace);
    }

    return undefined;
  }

  toVariable(metric: string) {
    return this.templateSrv.replace((metric || '').trim());
  }

  getSubscriptions(route?: string) {
    const url = `/${route || this.cloudName}/subscriptions?api-version=2019-03-01`;
    return this.doRequest(url).then((result: any) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  getResourceGroups(subscriptionId: string) {
    const url = `${this.baseUrl}/${subscriptionId}/resourceGroups?api-version=${this.apiVersion}`;
    return this.doRequest(url).then((result: AzureMonitorResourceGroupsResponse) => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    const url = `${this.baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${
      this.apiVersion
    }`;
    return this.doRequest(url)
      .then((result: AzureMonitorMetricDefinitionsResponse) => {
        return ResponseParser.parseResponseValues(result, 'type', 'type');
      })
      .then((result: any) => {
        return _.filter(result, t => {
          for (let i = 0; i < this.supportedMetricNamespaces.length; i++) {
            if (t.value.toLowerCase() === this.supportedMetricNamespaces[i].toLowerCase()) {
              return true;
            }
          }

          return false;
        });
      })
      .then((result: any) => {
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

        return result;
      });
  }

  getResourceNames(subscriptionId: string, resourceGroup: string, metricDefinition: string) {
    const url = `${this.baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${
      this.apiVersion
    }`;

    return this.doRequest(url).then((result: any) => {
      if (!_.startsWith(metricDefinition, 'Microsoft.Storage/storageAccounts/')) {
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
      this.baseUrl,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      this.apiPreviewVersion
    );

    return this.doRequest(url).then((result: any) => {
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
      this.baseUrl,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace,
      this.apiVersion
    );

    return this.doRequest(url).then((result: any) => {
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
      this.baseUrl,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace,
      this.apiVersion
    );

    return this.doRequest(url).then((result: any) => {
      return ResponseParser.parseMetadata(result, metricName);
    });
  }

  testDatasource() {
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

    const url = `/${this.cloudName}/subscriptions?api-version=2019-03-01`;
    return this.doRequest(url)
      .then((response: any) => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: 'Successfully queried the Azure Monitor service.',
            title: 'Success',
          };
        }

        return {
          status: 'error',
          message: 'Returned http status code ' + response.status,
        };
      })
      .catch((error: any) => {
        let message = 'Azure Monitor: ';
        message += error.statusText ? error.statusText + ': ' : '';

        if (error.data && error.data.error && error.data.error.code) {
          message += error.data.error.code + '. ' + error.data.error.message;
        } else if (error.data && error.data.error) {
          message += error.data.error;
        } else if (error.data) {
          message += error.data;
        } else {
          message += 'Cannot connect to Azure Monitor REST API.';
        }
        return {
          status: 'error',
          message: message,
        };
      });
  }

  isValidConfigField(field: string) {
    return field && field.length > 0;
  }

  doRequest(url: string, maxRetries = 1) {
    return this.backendSrv
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch((error: any) => {
        if (maxRetries > 0) {
          return this.doRequest(url, maxRetries - 1);
        }

        throw error;
      });
  }
}
