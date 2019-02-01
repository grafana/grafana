import _ from 'lodash';
import AzureMonitorFilterBuilder from './azure_monitor_filter_builder';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';

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
  constructor(private instanceSettings, private backendSrv, private templateSrv, private $q) {
    this.id = instanceSettings.id;
    this.subscriptionId = instanceSettings.jsonData.subscriptionId;
    this.cloudName = instanceSettings.jsonData.cloudName || 'azuremonitor';
    this.baseUrl = `/${this.cloudName}/subscriptions/${this.subscriptionId}/resourceGroups`;
    this.url = instanceSettings.url;

    this.supportedMetricNamespaces = new SupportedNamespaces(this.cloudName).get();
  }

  isConfigured(): boolean {
    return !!this.subscriptionId && this.subscriptionId.length > 0;
  }

  query(options) {
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
        format: options.format,
        alias: item.alias,
        raw: false,
      };
    });

    if (!queries || queries.length === 0) {
      return;
    }

    const promises = this.doQueries(queries);

    return this.$q.all(promises).then(results => {
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
    const resourceGroupsQuery = query.match(/^ResourceGroups\(\)/i);
    if (resourceGroupsQuery) {
      return this.getResourceGroups();
    }

    const metricDefinitionsQuery = query.match(/^Namespaces\(([^\)]+?)(,\s?([^,]+?))?\)/i);
    if (metricDefinitionsQuery) {
      return this.getMetricDefinitions(this.toVariable(metricDefinitionsQuery[1]));
    }

    const resourceNamesQuery = query.match(/^ResourceNames\(([^,]+?),\s?([^,]+?)\)/i);
    if (resourceNamesQuery) {
      const resourceGroup = this.toVariable(resourceNamesQuery[1]);
      const metricDefinition = this.toVariable(resourceNamesQuery[2]);
      return this.getResourceNames(resourceGroup, metricDefinition);
    }

    const metricNamesQuery = query.match(/^MetricNames\(([^,]+?),\s?([^,]+?),\s?(.+?)\)/i);

    if (metricNamesQuery) {
      const resourceGroup = this.toVariable(metricNamesQuery[1]);
      const metricDefinition = this.toVariable(metricNamesQuery[2]);
      const resourceName = this.toVariable(metricNamesQuery[3]);
      return this.getMetricNames(resourceGroup, metricDefinition, resourceName);
    }

    return undefined;
  }

  toVariable(metric: string) {
    return this.templateSrv.replace((metric || '').trim());
  }

  getResourceGroups() {
    const url = `${this.baseUrl}?api-version=${this.apiVersion}`;
    return this.doRequest(url).then(result => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(resourceGroup: string) {
    const url = `${this.baseUrl}/${resourceGroup}/resources?api-version=${this.apiVersion}`;
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

  getResourceNames(resourceGroup: string, metricDefinition: string) {
    const url = `${this.baseUrl}/${resourceGroup}/resources?api-version=${this.apiVersion}`;

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

  getMetricNames(resourceGroup: string, metricDefinition: string, resourceName: string) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.baseUrl,
      resourceGroup,
      metricDefinition,
      resourceName,
      this.apiVersion
    );

    return this.doRequest(url).then(result => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(resourceGroup: string, metricDefinition: string, resourceName: string, metricName: string) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.baseUrl,
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

    const url = `${this.baseUrl}?api-version=${this.apiVersion}`;
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
