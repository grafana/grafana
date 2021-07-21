import { filter, startsWith } from 'lodash';
import UrlBuilder from './url_builder';
import ResponseParser from './response_parser';
import SupportedNamespaces from './supported_namespaces';
import TimegrainConverter from '../time_grain_converter';
import {
  AzureMonitorQuery,
  AzureDataSourceJsonData,
  AzureMonitorMetricDefinitionsResponse,
  AzureMonitorResourceGroupsResponse,
  AzureQueryType,
  AzureMetricQuery,
  DatasourceValidationResult,
} from '../types';
import {
  DataSourceInstanceSettings,
  ScopedVars,
  MetricFindValue,
  DataQueryResponse,
  DataQueryRequest,
  TimeRange,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import { resourceTypeDisplayNames } from '../azureMetadata';
import { routeNames } from '../utils/common';

const defaultDropdownValue = 'select';

// Used to convert our aggregation value to the Azure enum for deep linking
const aggregationTypeMap: Record<string, number> = {
  None: 0,
  Total: 1,
  Minimum: 2,
  Maximum: 3,
  Average: 4,
  Count: 7,
};

export default class AzureMonitorDatasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  defaultSubscriptionId?: string;
  resourcePath: string;
  azurePortalUrl: string;
  resourceGroup: string;
  resourceName: string;
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

  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    const metricQueries = request.targets.reduce((prev: Record<string, AzureMonitorQuery>, cur) => {
      prev[cur.refId] = cur;
      return prev;
    }, {});

    return super.query(request).pipe(
      mergeMap((res: DataQueryResponse) => {
        return from(this.processResponse(res, metricQueries));
      })
    );
  }

  async processResponse(
    res: DataQueryResponse,
    metricQueries: Record<string, AzureMonitorQuery>
  ): Promise<DataQueryResponse> {
    if (res.data) {
      for (const df of res.data) {
        const metricQuery = metricQueries[df.refId];
        if (!metricQuery.azureMonitor || !metricQuery.subscription) {
          continue;
        }

        const url = this.buildAzurePortalUrl(
          metricQuery.azureMonitor,
          metricQuery.subscription,
          this.timeSrv.timeRange()
        );

        for (const field of df.fields) {
          field.config.links = [
            {
              url: url,
              title: 'View in Azure Portal',
              targetBlank: true,
            },
          ];
        }
      }
    }
    return res;
  }

  stringifyAzurePortalUrlParam(value: string | object): string {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    return encodeURIComponent(stringValue);
  }

  buildAzurePortalUrl(metricQuery: AzureMetricQuery, subscriptionId: string, timeRange: TimeRange) {
    const aggregationType =
      (metricQuery.aggregation && aggregationTypeMap[metricQuery.aggregation]) ?? aggregationTypeMap.Average;

    const chartDef = this.stringifyAzurePortalUrlParam({
      v2charts: [
        {
          metrics: [
            {
              resourceMetadata: {
                id: `/subscriptions/${subscriptionId}/resourceGroups/${metricQuery.resourceGroup}/providers/${metricQuery.metricDefinition}/${metricQuery.resourceName}`,
              },
              name: metricQuery.metricName,
              aggregationType: aggregationType,
              namespace: metricQuery.metricNamespace,
              metricVisualization: {
                displayName: metricQuery.metricName,
                resourceDisplayName: metricQuery.resourceName,
              },
            },
          ],
        },
      ],
    });

    const timeContext = this.stringifyAzurePortalUrlParam({
      absolute: {
        startTime: timeRange.from,
        endTime: timeRange.to,
      },
    });

    return `${this.azurePortalUrl}/#blade/Microsoft_Azure_MonitoringMetrics/Metrics.ReactView/Referer/MetricsExplorer/TimeContext/${timeContext}/ChartDefinition/${chartDef}`;
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
      const metricDefinition = this.toVariable(metricNamespaceQuery[2]);
      const resourceName = this.toVariable(metricNamespaceQuery[3]);
      return this.getMetricNamespaces(this.defaultSubscriptionId, resourceGroup, metricDefinition, resourceName);
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
    if (metricNamesQuery && this.defaultSubscriptionId) {
      if (metricNamesQuery[3].indexOf(',') === -1) {
        const resourceGroup = this.toVariable(metricNamesQuery[1]);
        const metricDefinition = this.toVariable(metricNamesQuery[2]);
        const resourceName = this.toVariable(metricNamesQuery[3]);
        const metricNamespace = this.toVariable(metricNamesQuery[4]);
        return this.getMetricNames(
          this.defaultSubscriptionId,
          resourceGroup,
          metricDefinition,
          resourceName,
          metricNamespace
        );
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

    return null;
  }

  toVariable(metric: string) {
    return getTemplateSrv().replace((metric || '').trim());
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
      `${this.resourcePath}/${subscriptionId}/resourceGroups?api-version=${this.apiVersion}`
    ).then((result: AzureMonitorResourceGroupsResponse) => {
      return ResponseParser.parseResponseValues(result, 'name', 'name');
    });
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    return this.getResource(
      `${this.resourcePath}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${this.apiVersion}`
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
      `${this.resourcePath}/${subscriptionId}/resourceGroups/${resourceGroup}/resources?api-version=${this.apiVersion}`
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
