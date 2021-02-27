import _ from 'lodash';
import LogAnalyticsQuerystringBuilder from '../log_analytics/querystring_builder';
import { AzureMonitorQuery, AzureDataSourceJsonData, AzureLogsVariable, AzureQueryType } from '../types';
import {
  DataQueryRequest,
  DataQueryResponse,
  ScopedVars,
  DataSourceInstanceSettings,
  MetricFindValue,
} from '@grafana/data';
import { getBackendSrv, getTemplateSrv, DataSourceWithBackend } from '@grafana/runtime';
import { Observable, from } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import ResponseParser from './response_parser';
import { LogConfigs } from '../datasource';

export default class AzureLogAnalyticsDatasource extends DataSourceWithBackend<
  AzureMonitorQuery,
  AzureDataSourceJsonData
> {
  url: string;
  baseUrl: string;
  applicationId: string;
  azureMonitorUrl: string;
  defaultOrFirstWorkspace: string;
  defaultOrFirstResource: string;
  subscriptionId: string;
  cache: Map<string, any>;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    private readonly configs: LogConfigs
  ) {
    super(instanceSettings);
    this.cache = new Map();

    switch (this.instanceSettings.jsonData.cloudName) {
      case 'govazuremonitor': // Azure US Government
        this.baseUrl = `/gov${configs.postfix}`;
        break;
      case 'germanyazuremonitor': // Azure Germany
        break;
      case 'chinaazuremonitor': // Azure China
        this.baseUrl = `/china${configs.postfix}`;
        break;
      default:
        // Azure Global
        this.baseUrl = `/${configs.postfix}`;
    }

    this.url = instanceSettings.url || '';
    this.defaultOrFirstWorkspace = this.instanceSettings.jsonData.logAnalyticsDefaultWorkspace || '';
    this.defaultOrFirstResource = this.instanceSettings.jsonData.logAnalyticsDefaultResource || '';

    this.setUrl();
  }

  isConfigured(): boolean | undefined {
    return (
      (typeof this.configs.subscriptionId === 'string' && this.configs.subscriptionId?.length > 0) ||
      this.configs.sameAsAzureMonitor
    );
  }

  setUrl() {
    if (!!this.instanceSettings.jsonData.subscriptionId || !!this.configs.sameAsAzureMonitor) {
      this.subscriptionId = this.instanceSettings.jsonData.subscriptionId;
      const azureCloud = this.instanceSettings.jsonData.cloudName || 'azuremonitor';
      this.azureMonitorUrl = `/${azureCloud}/subscriptions`;
    } else {
      this.subscriptionId = this.configs.subscriptionId || '';

      switch (this.instanceSettings.jsonData.cloudName) {
        case 'govazuremonitor': // Azure US Government
          this.azureMonitorUrl = `/gov${this.configs.azureMonitorPostfix}/subscriptions`;
          break;
        case 'germanyazuremonitor': // Azure Germany
          break;
        case 'chinaazuremonitor': // Azure China
          this.azureMonitorUrl = `/china${this.configs.azureMonitorPostfix}/subscriptions`;
          break;
        default:
          // Azure Global
          this.azureMonitorUrl = `/${this.configs.azureMonitorPostfix}/subscriptions`;
      }
    }
  }

  async getWorkspacesOrResources(subscription: string): Promise<AzureLogsVariable[]> {
    return this.configs.getWorkspacesOrResources(subscription, this.url);
  }

  // TODO change this when support templating variables for resources.
  getList(subscription: string): Promise<any> {
    const subscriptionId = subscription || this.subscriptionId;

    const workspaceListUrl =
      this.azureMonitorUrl +
      `/${subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2017-04-26-preview`;
    return this.doRequest(workspaceListUrl, undefined, undefined, true);
  }

  getSchema(id: string) {
    if (!id) {
      return Promise.resolve();
    }

    return this.configs.queryType === AzureQueryType.LogAnalytics
      ? this.doRequest(`${this.baseUrl}/${getTemplateSrv().replace(id, {})}/metadata`).then((response: any) =>
          new ResponseParser(response.data).parseSchemaResult()
        )
      : this.doRequest(`${this.baseUrl}${getTemplateSrv().replace(id, {})}/metadata`, 'POST').then((response: any) =>
          new ResponseParser(response.data).parseSchemaResult()
        );
  }

  applyTemplateVariables(target: AzureMonitorQuery, scopedVars: ScopedVars): Record<string, any> {
    if (this.configs.queryType === AzureQueryType.LogAnalytics) {
      const item = target.azureLogAnalytics;

      const templateSrv = getTemplateSrv();
      let workspace = templateSrv.replace(item.workspace, scopedVars);

      if (!workspace && this.defaultOrFirstWorkspace) {
        workspace = this.defaultOrFirstWorkspace;
      }

      const subscriptionId = templateSrv.replace(target.subscription || this.subscriptionId, scopedVars);
      const query = templateSrv.replace(item.query, scopedVars, this.interpolateVariable);

      return {
        refId: target.refId,
        format: target.format,
        queryType: AzureQueryType.LogAnalytics,
        subscriptionId: subscriptionId,
        azureLogAnalytics: {
          resultFormat: item.resultFormat,
          query: query,
          workspace: workspace,
        },
      };
    } else {
      const item = target.azureResourceLogAnalytics;

      const templateSrv = getTemplateSrv();
      let resource = templateSrv.replace(item.resource, scopedVars);

      if (!resource && this.defaultOrFirstResource) {
        resource = this.defaultOrFirstResource;
      }

      const subscriptionId = templateSrv.replace(target.subscription || this.subscriptionId, scopedVars);
      const query = templateSrv.replace(item.query, scopedVars, this.interpolateVariable);

      return {
        refId: target.refId,
        format: target.format,
        queryType: AzureQueryType.ResourceLogAnalytics,
        subscriptionId: subscriptionId,
        azureResourceLogAnalytics: {
          resultFormat: item.resultFormat,
          query: query,
          resource: resource,
        },
      };
    }
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
    const workspaceId = customMeta.workspace;
    const subscription = customMeta.subscription;

    const details = await this.getWorkspaceDetails(workspaceId);
    if (!details.workspace || !details.resourceGroup) {
      return '';
    }

    const url =
      `https://portal.azure.com/#blade/Microsoft_OperationsManagementSuite_Workspace/` +
      `AnalyticsBlade/initiator/AnalyticsShareLinkToQuery/isQueryEditorVisible/true/scope/` +
      `%7B%22resources%22%3A%5B%7B%22resourceId%22%3A%22%2Fsubscriptions%2F${subscription}` +
      `%2Fresourcegroups%2F${details.resourceGroup}%2Fproviders%2Fmicrosoft.operationalinsights%2Fworkspaces%2F${details.workspace}` +
      `%22%7D%5D%7D/query/${base64Enc}/isQueryBase64Compressed/true/timespanInIsoFormat/P1D`;
    return url;
  }

  async getWorkspaceDetails(workspaceId: string) {
    const response = await this.getList(this.subscriptionId);

    const details = response.data.value.find((o: any) => {
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

  /**
   * This is named differently than DataSourceApi.metricFindQuery
   * because it's not exposed to Grafana like the main AzureMonitorDataSource.
   * And some of the azure internal data sources return null in this function, which the
   * external interface does not support
   */
  metricFindQueryInternal(query: string): Promise<MetricFindValue[]> {
    const workspacesQuery = query.match(/^workspaces\(\)/i);
    if (workspacesQuery) {
      return this.getWorkspacesOrResources(this.subscriptionId);
    }

    const workspacesQueryWithSub = query.match(/^workspaces\(["']?([^\)]+?)["']?\)/i);
    if (workspacesQueryWithSub) {
      return this.getWorkspacesOrResources((workspacesQueryWithSub[1] || '').trim());
    }

    return this.getDefaultOrFirst().then((workspace: any) => {
      const queries: any[] = this.buildQuery(query, null, workspace);

      const promises = this.doQueries(queries);

      return Promise.all(promises)
        .then((results) => {
          return new ResponseParser(results).parseToVariables();
        })
        .catch((err) => {
          if (
            err.error &&
            err.error.data &&
            err.error.data.error &&
            err.error.data.error.innererror &&
            err.error.data.error.innererror.innererror
          ) {
            throw { message: err.error.data.error.innererror.innererror.message };
          } else if (err.error && err.error.data && err.error.data.error) {
            throw { message: err.error.data.error.message };
          }
        });
    }) as Promise<MetricFindValue[]>;
  }

  private buildQuery(query: string, options: any, workspace: any) {
    const querystringBuilder = new LogAnalyticsQuerystringBuilder(
      getTemplateSrv().replace(query, {}, this.interpolateVariable),
      options,
      'TimeGenerated'
    );
    const querystring = querystringBuilder.generate().uriString;
    const url = `${this.baseUrl}/${workspace}/query?${querystring}`;
    const queries: any[] = [];
    queries.push({
      datasourceId: this.id,
      url: url,
      resultFormat: 'table',
    });
    return queries;
  }

  interpolateVariable(value: string, variable: { multi: any; includeAll: any }) {
    if (typeof value === 'string') {
      if (variable.multi || variable.includeAll) {
        return "'" + value + "'";
      } else {
        return value;
      }
    }

    if (typeof value === 'number') {
      return value;
    }

    const quotedValues = _.map(value, (val) => {
      if (typeof value === 'number') {
        return value;
      }

      return "'" + val + "'";
    });
    return quotedValues.join(',');
  }

  getDefaultOrFirst() {
    if (this.configs.queryType === AzureQueryType.LogAnalytics) {
      if (this.defaultOrFirstWorkspace) {
        return Promise.resolve(this.defaultOrFirstWorkspace);
      }
      return this.getWorkspacesOrResources(this.subscriptionId).then((workspaces: any[]) => {
        this.defaultOrFirstWorkspace = workspaces[0].value;
        return this.defaultOrFirstWorkspace;
      });
    } else {
      if (this.defaultOrFirstResource) {
        return Promise.resolve(this.defaultOrFirstResource);
      }
      return this.getWorkspacesOrResources(this.subscriptionId).then((resources: any[]) => {
        this.defaultOrFirstResource = resources[0].value;
        return this.defaultOrFirstResource;
      });
    }
  }

  annotationQuery(options: any) {
    if (!options.annotation.rawQuery) {
      return Promise.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const queries: any[] = this.buildQuery(options.annotation.rawQuery, options, options.annotation.workspace);

    const promises = this.doQueries(queries);

    return Promise.all(promises).then((results) => {
      const annotations = new ResponseParser(results).transformToAnnotations(options);
      return annotations;
    });
  }

  doQueries(queries: any[]) {
    return _.map(queries, (query) => {
      return this.doRequest(query.url)
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

  async doRequest(url: string, method = 'GET', data?: any, useCache = false, maxRetries = 1): Promise<any> {
    try {
      if (useCache && this.cache.has(url)) {
        return this.cache.get(url);
      }

      const res = await getBackendSrv().datasourceRequest({
        url: this.url + url,
        method,
        data,
      });

      if (useCache) {
        this.cache.set(url, res);
      }

      return res;
    } catch (error) {
      if (maxRetries > 0) {
        return this.doRequest(url, method, data, useCache, maxRetries - 1);
      }

      throw error;
    }
  }

  testDatasource(): Promise<any> {
    const validationError = this.isValidConfig();
    if (validationError) {
      return Promise.resolve(validationError);
    }

    return this.getDefaultOrFirst()
      .then((ws: any) => {
        return this.configs.queryType === AzureQueryType.LogAnalytics
          ? this.doRequest(`${this.baseUrl}/${ws}/metadata`, 'GET')
          : this.doRequest(`${this.baseUrl}${ws}/metadata`, 'POST');
      })
      .then((response: any) => {
        if (response.status === 200) {
          return {
            status: 'success',
            message: `Successfully queried the ${this.configs.queryType} service.`,
            title: 'Success',
          };
        }

        return {
          status: 'error',
          message: 'Returned http status code ' + response.status,
        };
      })
      .catch((error: any) => {
        let message = `${this.configs.queryType}: `;
        if (error.config && error.config.url && error.config.url.indexOf(this.configs.azureMonitorPostfix) > -1) {
          message = `${this.configs.queryType} requires access to Azure Monitor but had the following error: `;
        }

        message = this.getErrorMessage(message, error);

        return {
          status: 'error',
          message: message,
        };
      });
  }

  private getErrorMessage(message: string, error: any) {
    message += error.statusText ? error.statusText + ': ' : '';
    if (error.data && error.data.error && error.data.error.code) {
      message += error.data.error.code + '. ' + error.data.error.message;
    } else if (error.data && error.data.error) {
      message += error.data.error;
    } else if (error.data) {
      message += error.data;
    } else {
      message += 'Cannot connect to Azure Log Analytics REST API.';
    }
    return message;
  }

  isValidConfig() {
    if (this.configs.sameAsAzureMonitor) {
      return undefined;
    }

    if (!this.isValidConfigField(this.configs.subscriptionId)) {
      return {
        status: 'error',
        message: 'The Subscription Id field is required.',
      };
    }

    if (!this.isValidConfigField(this.instanceSettings.jsonData.logAnalyticsTenantId)) {
      return {
        status: 'error',
        message: 'The Tenant Id field is required.',
      };
    }

    if (!this.isValidConfigField(this.instanceSettings.jsonData.logAnalyticsClientId)) {
      return {
        status: 'error',
        message: 'The Client Id field is required.',
      };
    }

    return undefined;
  }

  isValidConfigField(field: string | undefined) {
    return field && field.length > 0;
  }
}
