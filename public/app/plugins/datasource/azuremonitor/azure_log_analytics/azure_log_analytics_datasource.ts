import { map } from 'lodash';

import { AzureCredentials } from '@grafana/azure-sdk';
import { ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import ResponseParser from '../azure_monitor/response_parser';
import { getCredentials } from '../credentials';
import { AzureMonitorQuery, AzureQueryType } from '../types/query';
import {
  AzureMonitorDataSourceJsonData,
  AzureMonitorDataSourceInstanceSettings,
  AzureAPIResponse,
  AzureLogsVariable,
  Workspace,
  DatasourceValidationResult,
  Subscription,
} from '../types/types';
import { interpolateVariable, routeNames } from '../utils/common';

import { transformMetadataToKustoSchema } from './utils';

export default class AzureLogAnalyticsDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureMonitorDataSourceJsonData
> {
  readonly credentials: AzureCredentials;
  resourcePath: string;
  declare applicationId: string;

  defaultSubscriptionId?: string;

  azureMonitorPath: string;
  firstWorkspace?: string;

  constructor(
    private instanceSettings: AzureMonitorDataSourceInstanceSettings,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.credentials = getCredentials(instanceSettings);

    this.resourcePath = `${routeNames.logAnalytics}`;
    this.azureMonitorPath = `${routeNames.azureMonitor}/subscriptions`;

    this.defaultSubscriptionId = this.instanceSettings.jsonData.subscriptionId || '';
  }

  isConfigured(): boolean {
    // If validation didn't return any error then the data source is properly configured
    return !this.validateDatasource();
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return (
      item.hide !== true &&
      ((!!item.azureLogAnalytics?.query &&
        (!!item.azureLogAnalytics.resources?.length || !!item.azureLogAnalytics.workspace)) ||
        !!item.azureTraces?.resources?.length)
    );
  }

  async getSubscriptions(): Promise<Array<{ text: string; value: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    const path = `${this.azureMonitorPath}?api-version=2019-03-01`;
    return await this.getResource<AzureAPIResponse<Subscription>>(path).then((result) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  async getWorkspaces(subscription: string): Promise<AzureLogsVariable[]> {
    const response = await this.getWorkspaceList(subscription);

    return (
      map(response.value, (val: Workspace) => {
        return {
          text: val.name,
          value: val.id,
        };
      }) || []
    );
  }

  private getWorkspaceList(subscription: string): Promise<AzureAPIResponse<Workspace>> {
    const subscriptionId = this.templateSrv.replace(subscription || this.defaultSubscriptionId);

    const workspaceListUrl =
      this.azureMonitorPath +
      `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;
    return this.getResource<AzureAPIResponse<Workspace>>(workspaceListUrl);
  }

  async getMetadata(resourceUri: string) {
    const path = `${this.resourcePath}/v1${resourceUri}/metadata`;

    const resp = await this.getResource(path);
    return resp;
  }

  async getKustoSchema(resourceUri: string) {
    const interpolatedUri = this.templateSrv.replace(resourceUri, {}, interpolateVariable);
    const metadata = await this.getMetadata(interpolatedUri);
    return transformMetadataToKustoSchema(metadata, interpolatedUri, this.templateSrv.getVariables());
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    let item;
    if (target.queryType === AzureQueryType.LogAnalytics && target.azureLogAnalytics) {
      item = target.azureLogAnalytics;
      const resources = this.expandResourcesForMultipleVariables(item.resources, scopedVars);
      let workspace = this.templateSrv.replace(item.workspace, scopedVars);

      if (!workspace && !resources && this.firstWorkspace) {
        workspace = this.firstWorkspace;
      }

      const query = this.templateSrv.replace(item.query, scopedVars, interpolateVariable);

      return {
        ...target,
        queryType: target.queryType || AzureQueryType.LogAnalytics,

        azureLogAnalytics: {
          builderQuery: item.builderQuery,
          resultFormat: item.resultFormat,
          query,
          resources,
          // Workspace was removed in Grafana 8, but remains for backwards compat
          workspace,
          dashboardTime: item.dashboardTime,
          basicLogsQuery: item.basicLogsQuery,
          timeColumn: this.templateSrv.replace(item.timeColumn, scopedVars),
        },
      };
    }

    if (target.queryType === AzureQueryType.AzureTraces && target.azureTraces) {
      item = target.azureTraces;
      const resources = this.expandResourcesForMultipleVariables(item.resources, scopedVars);
      const query = this.templateSrv.replace(item.query, scopedVars, interpolateVariable);
      const traceTypes = item.traceTypes?.map((t) => this.templateSrv.replace(t, scopedVars));
      const filters = (item.filters ?? [])
        .filter((f) => !!f.property)
        .map((f) => {
          const filtersReplaced = f.filters?.map((filter) => this.templateSrv.replace(filter ?? '', scopedVars));
          return {
            property: this.templateSrv.replace(f.property, scopedVars),
            operation: f.operation || 'eq',
            filters: filtersReplaced || [],
          };
        });

      return {
        ...target,
        queryType: target.queryType || AzureQueryType.AzureTraces,

        azureTraces: {
          resultFormat: item.resultFormat,
          query,
          resources,
          operationId: this.templateSrv.replace(target.azureTraces?.operationId, scopedVars),
          filters,
          traceTypes,
        },
      };
    }

    return target;
  }

  private expandResourcesForMultipleVariables(
    resources: string[] | undefined,
    scopedVars: ScopedVars
  ): string[] | undefined {
    if (!resources) {
      return undefined;
    }
    const expandedResources: string[] = [];
    resources.forEach((r: string) => {
      const tempVars = this.templateSrv.replace(r, scopedVars, 'raw');
      const values = tempVars.split(',');
      values.forEach((value) => {
        expandedResources.push(value);
      });
    });
    return expandedResources;
  }

  /*
    In 7.5.x it used to be possible to set a default workspace id in the config on the auth page.
    This has been deprecated, however is still used by a few legacy template queries.
  */
  getDeprecatedDefaultWorkSpace() {
    return this.instanceSettings.jsonData.logAnalyticsDefaultWorkspace;
  }

  async getDefaultOrFirstSubscription(): Promise<string | undefined> {
    if (this.defaultSubscriptionId) {
      return this.defaultSubscriptionId;
    }
    const subscriptions = await this.getSubscriptions();
    return subscriptions[0]?.value;
  }

  async getFirstWorkspace(): Promise<string | undefined> {
    if (this.firstWorkspace) {
      return this.firstWorkspace;
    }

    const subscriptionId = await this.getDefaultOrFirstSubscription();
    if (!subscriptionId) {
      return undefined;
    }

    const workspaces = await this.getWorkspaces(subscriptionId);
    const workspace = workspaces[0]?.value;

    if (workspace) {
      this.firstWorkspace = workspace;
    }

    return workspace;
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

  private isValidConfigField(field: string | undefined): boolean {
    return typeof field === 'string' && field.length > 0;
  }

  async getAzureLogAnalyticsCheatsheetQueries() {
    return await this.getResource(`${this.resourcePath}/v1/metadata`);
  }

  async getBasicLogsQueryUsage(query: AzureMonitorQuery, table: string): Promise<number> {
    const templateSrv = getTemplateSrv();

    const data = {
      table: table,
      resource: templateSrv.replace(query.azureLogAnalytics?.resources?.[0]),
      queryType: query.queryType,
      from: templateSrv.replace('$__from'),
      to: templateSrv.replace('$__to'),
    };
    return await this.postResource(`${this.resourcePath}/usage/basiclogs`, data);
  }
}
