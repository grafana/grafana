import { map } from 'lodash';
import { from, Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceRef,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv } from '@grafana/runtime';

import { isGUIDish } from '../components/ResourcePicker/utils';
import { getAuthType, getAzureCloud, getAzurePortalUrl } from '../credentials';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import {
  AzureDataSourceJsonData,
  AzureLogsVariable,
  AzureMonitorQuery,
  AzureQueryType,
  DatasourceValidationResult,
} from '../types';
import { interpolateVariable, routeNames } from '../utils/common';

import ResponseParser, { transformMetadataToKustoSchema } from './response_parser';

interface AdhocQuery {
  datasource: DataSourceRef;
  path: string;
  resultFormat: string;
}

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
  cache: Map<string, any>;

  constructor(private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.cache = new Map();

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
      (!!item.azureLogAnalytics.resource || !!item.azureLogAnalytics.workspace)
    );
  }

  async getSubscriptions(): Promise<Array<{ text: string; value: string }>> {
    if (!this.isConfigured()) {
      return [];
    }

    const path = `${this.azureMonitorPath}?api-version=2019-03-01`;
    return await this.getResource(path).then((result: any) => {
      return ResponseParser.parseSubscriptions(result);
    });
  }

  async getWorkspaces(subscription: string): Promise<AzureLogsVariable[]> {
    const response = await this.getWorkspaceList(subscription);

    return (
      map(response.value, (val: any) => {
        return {
          text: val.name,
          value: val.id,
        };
      }) || []
    );
  }

  private getWorkspaceList(subscription: string): Promise<any> {
    const subscriptionId = getTemplateSrv().replace(subscription || this.defaultSubscriptionId);

    const workspaceListUrl =
      this.azureMonitorPath +
      `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;
    return this.getResource(workspaceListUrl);
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
    const resource = templateSrv.replace(item.resource, scopedVars);
    let workspace = templateSrv.replace(item.workspace, scopedVars);

    if (!workspace && !resource && this.firstWorkspace) {
      workspace = this.firstWorkspace;
    }

    const query = templateSrv.replace(item.query, scopedVars, interpolateVariable);

    return {
      ...target,
      queryType: AzureQueryType.LogAnalytics,

      azureLogAnalytics: {
        resultFormat: item.resultFormat,
        query,
        resource,

        // Workspace was removed in Grafana 8, but remains for backwards compat
        workspace,
      },
    };
  }

  /**
   * Augment the results with links back to the azure console
   */
  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    return super.query(request).pipe(
      mergeMap((res: DataQueryResponse) => {
        return from(this.processResponse(res));
      })
    );
  }

  async processResponse(res: DataQueryResponse): Promise<DataQueryResponse> {
    if (res.data) {
      for (const df of res.data) {
        const encodedQuery = df.meta?.custom?.encodedQuery;
        if (encodedQuery && encodedQuery.length > 0) {
          const url = await this.buildDeepLink(df.meta.custom);
          if (url?.length) {
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
      }
    }
    return res;
  }

  private async buildDeepLink(customMeta: Record<string, any>) {
    const base64Enc = encodeURIComponent(customMeta.encodedQuery);
    const resource = encodeURIComponent(customMeta.resource);

    const url =
      `${this.azurePortalUrl}/#blade/Microsoft_OperationsManagementSuite_Workspace/` +
      `AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/` +
      `%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22${resource}` +
      `%22%7D%5D%7D/query/${base64Enc}/isQueryBase64Compressed/true/timespanInIsoFormat/P1D`;
    return url;
  }

  async getWorkspaceDetails(workspaceId: string) {
    if (!this.defaultSubscriptionId) {
      return {};
    }
    const response = await this.getWorkspaceList(this.defaultSubscriptionId);

    const details = response.value.find((o: any) => {
      return o.properties.customerId === workspaceId;
    });

    if (!details) {
      return {};
    }

    const regex = /.*resourcegroups\/(.*)\/providers.*/;
    const results = regex.exec(details.id);
    if (!results || results.length < 2) {
      return {};
    }

    return {
      workspace: details.name,
      resourceGroup: results[1],
    };
  }

  /*
    In 7.5.x it used to be possible to set a default workspace id in the config on the auth page.
    This has been deprecated, however is still used by a few legacy template queries.
  */
  getDeprecatedDefaultWorkSpace() {
    return this.instanceSettings.jsonData.logAnalyticsDefaultWorkspace;
  }

  private buildQuery(query: string, options: any, workspace: string): AdhocQuery[] {
    const querystringBuilder = new LogAnalyticsQuerystringBuilder(
      getTemplateSrv().replace(query, {}, interpolateVariable),
      options,
      'TimeGenerated'
    );

    const querystring = querystringBuilder.generate().uriString;
    const path = isGUIDish(workspace)
      ? `${this.resourcePath}/v1/workspaces/${workspace}/query?${querystring}`
      : `${this.resourcePath}/v1${workspace}/query?${querystring}`;

    const queries = [
      {
        datasource: this.getRef(),
        path: path,
        resultFormat: 'table',
      },
    ];

    return queries;
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

  annotationQuery(options: any) {
    if (!options.annotation.rawQuery) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const queries = this.buildQuery(options.annotation.rawQuery, options, options.annotation.workspace);
    const promises = this.doQueries(queries);

    return Promise.all(promises).then((results) => {
      const annotations = new ResponseParser(results).transformToAnnotations(options);
      return annotations;
    });
  }

  doQueries(queries: AdhocQuery[]) {
    return map(queries, (query) => {
      return this.getResource(query.path)
        .then((result: any) => {
          return {
            result: result,
            query: query,
          };
        })
        .catch((err: any) => {
          throw {
            error: err,
            query: query,
          };
        });
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

  private isValidConfigField(field: string | undefined): boolean {
    return typeof field === 'string' && field.length > 0;
  }
}
