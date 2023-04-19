import { map } from 'lodash';

import { DataSourceInstanceSettings, ScopedVars } from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import ResponseParser from '../azure_monitor/response_parser';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import {
  AzureAPIResponse,
  AzureDataSourceJsonData,
  AzureLogsVariable,
  AzureMonitorQuery,
  AzureQueryType,
  DatasourceValidationResult,
  Subscription,
  Workspace,
} from '../types';
import { interpolateVariable, routeNames } from '../utils/common';

import { transformMetadataToKustoSchema } from './utils';

export default class AzureLogAnalyticsDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureDataSourceJsonData
> {
  resourcePath: string;
  azurePortalUrl: string;
  declare applicationId: string;

  defaultSubscriptionId?: string;

  azureMonitorPath: string;
  firstWorkspace?: string;

  constructor(private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);

    this.resourcePath = `${routeNames.logAnalytics}`;
    this.azureMonitorPath = `${routeNames.azureMonitor}/subscriptions`;
    const cloud = getAzureCloud(instanceSettings);
    this.azurePortalUrl = getAzurePortalUrl(cloud);

    this.defaultSubscriptionId = this.instanceSettings.jsonData.subscriptionId || '';
  }

  isConfigured(): boolean {
    // If validation didn't return any error then the data source is properly configured
    return !this.validateDatasource();
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    return (
      item.hide !== true &&
      !!item.azureLogAnalytics?.query &&
      (!!item.azureLogAnalytics.resources?.length || !!item.azureLogAnalytics.workspace)
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
    const subscriptionId = getTemplateSrv().replace(subscription || this.defaultSubscriptionId);

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
    const templateSrv = getTemplateSrv();
    const interpolatedUri = templateSrv.replace(resourceUri, {}, interpolateVariable);
    const metadata = await this.getMetadata(interpolatedUri);
    return transformMetadataToKustoSchema(metadata, interpolatedUri, templateSrv.getVariables());
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): AzureMonitorQuery {
    const item = target.azureLogAnalytics;
    if (!item) {
      return target;
    }

    const templateSrv = getTemplateSrv();
    const resources = item.resources?.map((r) => templateSrv.replace(r, scopedVars));
    let workspace = templateSrv.replace(item.workspace, scopedVars);

    if (!workspace && !resources && this.firstWorkspace) {
      workspace = this.firstWorkspace;
    }

    const query = templateSrv.replace(item.query, scopedVars, interpolateVariable);

    return {
      ...target,
      queryType: AzureQueryType.LogAnalytics,

      azureLogAnalytics: {
        resultFormat: item.resultFormat,
        query,
        resources,

        // Workspace was removed in Grafana 8, but remains for backwards compat
        workspace,
      },
    };
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

  private isValidConfigField(field: string | undefined): boolean {
    return typeof field === 'string' && field.length > 0;
  }
}
