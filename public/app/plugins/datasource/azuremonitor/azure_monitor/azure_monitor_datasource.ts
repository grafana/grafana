import { find } from 'lodash';

import { AzureCredentials } from '@grafana/azure-sdk';
import { ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import { getCredentials } from '../credentials';
import TimegrainConverter from '../time_grain_converter';
import { AzureMetricQuery, AzureMonitorQuery, AzureQueryType } from '../types/query';
import {
  AzureAPIResponse,
  AzureMonitorDataSourceInstanceSettings,
  AzureMonitorDataSourceJsonData,
  AzureMonitorLocations,
  AzureMonitorMetricsMetadataResponse,
  AzureMonitorProvidersResponse,
  DatasourceValidationResult,
  GetLogAnalyticsTableResponse,
  GetMetricMetadataQuery,
  GetMetricNamespacesQuery,
  GetMetricNamesQuery,
  instanceOfLogAnalyticsTableError,
  Location,
  Metric,
  MetricNamespace,
  Subscription,
  TablePlan,
} from '../types/types';
import { replaceTemplateVariables, routeNames } from '../utils/common';
import migrateQuery from '../utils/migrateQuery';

import ResponseParser from './response_parser';
import UrlBuilder from './url_builder';

const defaultDropdownValue = 'select';

function hasValue(item?: string) {
  return !!(item && item !== defaultDropdownValue);
}

export default class AzureMonitorDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  private readonly credentials: AzureCredentials;
  apiVersion = '2018-01-01';
  apiPreviewVersion = '2017-12-01-preview';
  listByResourceGroupApiVersion = '2021-04-01';
  providerApiVersion = '2021-04-01';
  locationsApiVersion = '2020-01-01';
  defaultSubscriptionId?: string;
  basicLogsEnabled?: boolean;
  resourcePath: string;
  declare resourceGroup: string;
  declare resourceName: string;

  constructor(
    instanceSettings: AzureMonitorDataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.credentials = getCredentials(instanceSettings);

    this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;
    this.basicLogsEnabled = instanceSettings.jsonData.basicLogsEnabled;

    this.resourcePath = routeNames.azureMonitor;
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
    const preMigrationQuery = target.azureMonitor;

    if (!preMigrationQuery) {
      throw new Error('Query is not a valid Azure Monitor Metrics query');
    }

    // These properties need to be replaced pre-migration to ensure values are correctly interpolated
    if (preMigrationQuery.resourceUri) {
      preMigrationQuery.resourceUri = this.templateSrv.replace(preMigrationQuery.resourceUri, scopedVars);
    }
    if (preMigrationQuery.metricDefinition) {
      preMigrationQuery.metricDefinition = this.templateSrv.replace(preMigrationQuery.metricDefinition, scopedVars);
    }

    // fix for timeGrainUnit which is a deprecated/removed field name
    if (preMigrationQuery.timeGrain && preMigrationQuery.timeGrainUnit && preMigrationQuery.timeGrain !== 'auto') {
      preMigrationQuery.timeGrain = TimegrainConverter.createISO8601Duration(
        preMigrationQuery.timeGrain,
        preMigrationQuery.timeGrainUnit
      );
    }

    const migratedTarget = migrateQuery(target);
    const migratedQuery = migratedTarget.azureMonitor;
    // This should never be triggered because the above error would've been thrown
    if (!migratedQuery) {
      throw new Error('Query is not a valid Azure Monitor Metrics query');
    }

    const subscriptionId = this.templateSrv.replace(
      migratedTarget.subscription || this.defaultSubscriptionId,
      scopedVars
    );
    const resources = migratedQuery.resources
      ?.map((r) => replaceTemplateVariables(this.templateSrv, r, scopedVars))
      .flat();
    const metricNamespace = this.templateSrv.replace(migratedQuery.metricNamespace, scopedVars);
    const customNamespace = this.templateSrv.replace(migratedQuery.customNamespace, scopedVars);
    const timeGrain = this.templateSrv.replace((migratedQuery.timeGrain || '').toString(), scopedVars);
    const aggregation = this.templateSrv.replace(migratedQuery.aggregation, scopedVars);
    const top = this.templateSrv.replace(migratedQuery.top || '', scopedVars);

    const dimensionFilters = (migratedQuery.dimensionFilters ?? [])
      .filter((f) => f.dimension && f.dimension !== 'None')
      .map((f) => {
        const filters = f.filters?.map((filter) => this.templateSrv.replace(filter ?? '', scopedVars));
        return {
          dimension: this.templateSrv.replace(f.dimension, scopedVars),
          operator: f.operator || 'eq',
          filters: filters || [],
        };
      });

    const azMonitorQuery: AzureMetricQuery = {
      ...migratedQuery,
      resources,
      metricNamespace,
      customNamespace,
      timeGrain,
      allowedTimeGrainsMs: migratedQuery.allowedTimeGrainsMs,
      metricName: this.templateSrv.replace(migratedQuery.metricName, scopedVars),
      region: this.templateSrv.replace(migratedQuery.region, scopedVars),
      aggregation: aggregation,
      dimensionFilters,
      top: top || '10',
      alias: migratedQuery.alias,
    };

    return {
      ...target,
      subscription: subscriptionId,
      queryType: AzureQueryType.AzureMonitor,
      azureMonitor: azMonitorQuery,
    };
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

  // Note globalRegion should be false when querying custom metric namespaces
  getMetricNamespaces(query: GetMetricNamespacesQuery, globalRegion: boolean, region?: string, custom?: boolean) {
    const url = UrlBuilder.buildAzureMonitorGetMetricNamespacesUrl(
      this.resourcePath,
      this.apiPreviewVersion,
      // Only use the first query, as the metric namespaces should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      globalRegion,
      this.templateSrv,
      region
    );
    return this.getResource(url)
      .then((result: AzureAPIResponse<MetricNamespace>) => {
        if (custom) {
          result.value = result.value.filter((namespace) => namespace.classification === 'Custom');
        }
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
      })
      .catch((reason) => {
        console.error(`Failed to get metric namespaces: ${reason}`);
        return [];
      });
  }

  getMetricNames(query: GetMetricNamesQuery, multipleResources?: boolean, region?: string) {
    const apiVersion = multipleResources ? this.apiPreviewVersion : this.apiVersion;
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      apiVersion,
      // Only use the first query, as the metric names should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      this.templateSrv,
      multipleResources,
      region
    );
    return this.getResource(url).then((result: AzureAPIResponse<Metric>) => {
      return ResponseParser.parseResponseValues(result, 'name.localizedValue', 'name.value');
    });
  }

  getMetricMetadata(query: GetMetricMetadataQuery, multipleResources?: boolean, region?: string) {
    const { metricName } = query;
    const apiVersion = multipleResources ? this.apiPreviewVersion : this.apiVersion;
    const url = UrlBuilder.buildAzureMonitorGetMetricNamesUrl(
      this.resourcePath,
      apiVersion,
      // Only use the first query, as the metric metadata should be the same for all queries
      this.replaceSingleTemplateVariables(query),
      this.templateSrv,
      multipleResources,
      region
    );
    return this.getResource(url).then((result: AzureMonitorMetricsMetadataResponse) => {
      return ResponseParser.parseMetadata(result, this.templateSrv.replace(metricName));
    });
  }

  private validateDatasource(): DatasourceValidationResult | undefined {
    if (this.credentials.authType === 'clientsecret') {
      if (!this.isValidConfigField(this.credentials.tenantId)) {
        return {
          status: 'error',
          message: 'The Tenant Id field is required.',
        };
      }

      if (!this.isValidConfigField(this.credentials.clientId)) {
        return {
          status: 'error',
          message: 'The Client Id field is required.',
        };
      }
    }

    return undefined;
  }

  async getWorkspaceTablePlan(resources: string[], tableName: string): Promise<TablePlan> {
    let workspaceUri = '';

    if (resources) {
      workspaceUri = resources[0];
    }

    if (!workspaceUri) {
      return TablePlan.Analytics;
    }

    if (workspaceUri && !workspaceUri.toLowerCase().includes('microsoft.operationalinsights/workspaces')) {
      // Not a Log Analytics workspace so default to Analytics
      return TablePlan.Analytics;
    }

    const url = UrlBuilder.buildAzureMonitorGetLogsTableUrl(
      this.resourcePath,
      this.templateSrv.replace(workspaceUri),
      this.templateSrv.replace(tableName)
    );
    const tableResult = await this.getResource<GetLogAnalyticsTableResponse>(url);

    if (!tableResult || instanceOfLogAnalyticsTableError(tableResult)) {
      return TablePlan.Analytics;
    }

    return tableResult.properties.plan || TablePlan.Analytics;
  }

  private isValidConfigField(field?: string): boolean {
    return typeof field === 'string' && field.length > 0;
  }

  private replaceSingleTemplateVariables<T extends { [K in keyof T]: string }>(query: T, scopedVars?: ScopedVars) {
    // This method evaluates template variables supporting multiple values but only returns the first value.
    // This will work as far as the first combination of variables is valid.
    // For example if 'rg1' contains 'res1' and 'rg2' contains 'res2' then
    // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res1', 'res2'] } would return
    // { resourceGroup: 'rg1', resourceName: 'res1' } which is valid but
    // { resourceGroup: ['rg1', 'rg2'], resourceName: ['res2'] } would result in
    // { resourceGroup: 'rg1', resourceName: 'res2' } which is not.
    return replaceTemplateVariables(this.templateSrv, query, scopedVars)[0];
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
