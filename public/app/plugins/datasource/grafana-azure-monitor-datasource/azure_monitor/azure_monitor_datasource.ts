import _ from 'lodash';
import AzureMonitorFilterBuilder from './azure_monitor_filter_builder';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
import { AzureMonitorQuery, AzureDataSourceJsonData } from '../types';
import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/ui/src/types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';

export default class AzureMonitorDatasource {
  apiVersion = '2018-01-01';
  id: number;
  subscriptionId: string;
  baseUrl: string;
  resourceGroup: string;
  resourceName: string;
  url: string;
  defaultDropdownValue = 'select';
  cloudName: string;
  supportedMetricNamespaces: any[] = [];

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

  async query(options: DataQueryRequest<AzureMonitorQuery>) {
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

      if (item.timeGrainUnit && item.timeGrain !== 'auto') {
        item.timeGrain = TimegrainConverter.createISO8601Duration(item.timeGrain, item.timeGrainUnit);
      }

      const subscriptionId = this.templateSrv.replace(target.subscription || this.subscriptionId, options.scopedVars);
      const resourceGroup = this.templateSrv.replace(item.resourceGroup, options.scopedVars);
      const resourceName = this.templateSrv.replace(item.resourceName, options.scopedVars);
      const metricDefinition = this.templateSrv.replace(item.metricDefinition, options.scopedVars);
      const timeGrain = this.templateSrv.replace((item.timeGrain || '').toString(), options.scopedVars);

      const filterBuilder = new AzureMonitorFilterBuilder(
        item.metricName,
        options.range.from,
        options.range.to,
        timeGrain,
        options.interval
      );

      if (item.timeGrains) {
        filterBuilder.setAllowedTimeGrains(item.timeGrains);
      }

      if (item.aggregation) {
        filterBuilder.setAggregation(item.aggregation);
      }

      if (item.dimension && item.dimension !== 'None') {
        filterBuilder.setDimensionFilter(item.dimension, item.dimensionFilter);
      }

      const filter = this.templateSrv.replace(filterBuilder.generateFilter(), options.scopedVars);

      const url = UrlBuilder.buildAzureMonitorQueryUrl(
        this.baseUrl,
        subscriptionId,
        resourceGroup,
        metricDefinition,
        resourceName,
        this.apiVersion,
        filter
      );

      return {
        refId: target.refId,
        intervalMs: options.intervalMs,
        maxDataPoints: options.maxDataPoints,
        datasourceId: this.id,
        url: url,
        format: target.format,
        alias: item.alias,
        raw: false,
      };
    });

    if (!queries || queries.length === 0) {
      return [];
    }

    const promises = this.doQueries(queries);

    return Promise.all(promises).then(results => {
      return new ResponseParser(results).parseQueryResult();
    });
  }

  doQueries(queries) {
    return _.map(queries, query => {
      return this.doRequest(query.url)
        .then(result => {
          return {
            result: result,
            query: query,
          };
        })
        .catch(err => {
          throw {
            error: err,
            query: query,
          };
        });
    });
  }

  annotationQuery(options) {}

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

    const metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);

    if (metricNamesQuery) {
      if (metricNamesQuery[3].indexOf(',') === -1) {
        const resourceGroup = this.toVariable(metricNamesQuery[1]);
        const metricDefinition = this.toVariable(metricNamesQuery[2]);
        const resourceName = this.toVariable(metricNamesQuery[3]);
        return this.getMetricNames(this.subscriptionId, resourceGroup, metricDefinition, resourceName);
      }
    }

    const metricNamesQueryWithSub = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);

    if (metricNamesQueryWithSub) {
      const subscription = this.toVariable(metricNamesQueryWithSub[1]);
      const resourceGroup = this.toVariable(metricNamesQueryWithSub[2]);
      const metricDefinition = this.toVariable(metricNamesQueryWithSub[3]);
      const resourceName = this.toVariable(metricNamesQueryWithSub[4]);
      return this.getMetricNames(subscription, resourceGroup, metricDefinition, resourceName);
    }

    return undefined;
  }

  toVariable(metric: string) {
    return this.templateSrv.replace((metric || '').trim());
  }

  getSubscriptions(route?: string) {
    const url = `/${route || this.cloudName}/subscriptions?api-version=2019-03-01`;
    return this.doRequest(url).then(result => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  getResourceGroups(subscriptionId: string) {
    const url = `${this.baseUrl}/${subscriptionId}/resourceGroups?api-version=${this.apiVersion}`;
    return this.doRequest(url).then(result => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    const url = `${this.baseUrl}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${
      this.apiVersion
    }`;
    return this.doRequest(url)
      .then(result => {
        return ResponseParser.parseResponseValues(result, 'type', 'type');
      })
      .then(result => {
        return _.filter(result, t => {
          for (let i = 0; i < this.supportedMetricNamespaces.length; i++) {
            if (t.value.toLowerCase() === this.supportedMetricNamespaces[i].toLowerCase()) {
              return true;
            }
          }

          return false;
        });
      })
      .then(result => {
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

    return this.doRequest(url).then(result => {
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

  getMetricNames(subscriptionId: string, resourceGroup: string, metricDefinition: string, resourceName: string) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.baseUrl,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      this.apiVersion
    );

    return this.doRequest(url).then(result => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricName: string
  ) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.baseUrl,
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      this.apiVersion
    );

    return this.doRequest(url).then(result => {
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
      .then(response => {
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
      .catch(error => {
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

  doRequest(url, maxRetries = 1) {
    return this.backendSrv
      .datasourceRequest({
        url: this.url + url,
        method: 'GET',
      })
      .catch(error => {
        if (maxRetries > 0) {
          return this.doRequest(url, maxRetries - 1);
        }

        throw error;
      });
  }
}
