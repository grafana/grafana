import _ from 'lodash';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AppInsightsDatasource from './app_insights/app_insights_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import { AzureMonitorQuery, AzureDataSourceJsonData, AzureQueryType, InsightsAnalyticsQuery } from './types';
import {
  DataSourceApi,
  DataQueryRequest,
  DataSourceInstanceSettings,
  DataQueryResponseData,
  LoadingState,
} from '@grafana/data';
import { Observable, of, from } from 'rxjs';
import { DataSourceWithBackend } from '@grafana/runtime';
import InsightsAnalyticsDatasource from './insights_analytics/insights_analytics_datasource';
import { migrateMetricsDimensionFilters } from './query_ctrl';

export default class Datasource extends DataSourceApi<AzureMonitorQuery, AzureDataSourceJsonData> {
  azureMonitorDatasource: AzureMonitorDatasource;
  appInsightsDatasource: AppInsightsDatasource;
  azureLogAnalyticsDatasource: AzureLogAnalyticsDatasource;
  insightsAnalyticsDatasource: InsightsAnalyticsDatasource;

  pseudoDatasource: Record<AzureQueryType, DataSourceWithBackend>;
  optionsKey: Record<AzureQueryType, string>;

  constructor(instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>) {
    super(instanceSettings);
    this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
    this.appInsightsDatasource = new AppInsightsDatasource(instanceSettings);
    this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
    this.insightsAnalyticsDatasource = new InsightsAnalyticsDatasource(instanceSettings);

    const pseudoDatasource: any = {};
    pseudoDatasource[AzureQueryType.ApplicationInsights] = this.appInsightsDatasource;
    pseudoDatasource[AzureQueryType.AzureMonitor] = this.azureMonitorDatasource;
    pseudoDatasource[AzureQueryType.InsightsAnalytics] = this.insightsAnalyticsDatasource;
    pseudoDatasource[AzureQueryType.LogAnalytics] = this.azureLogAnalyticsDatasource;
    this.pseudoDatasource = pseudoDatasource;

    const optionsKey: any = {};
    optionsKey[AzureQueryType.ApplicationInsights] = 'appInsights';
    optionsKey[AzureQueryType.AzureMonitor] = 'azureMonitor';
    optionsKey[AzureQueryType.InsightsAnalytics] = 'insightsAnalytics';
    optionsKey[AzureQueryType.LogAnalytics] = 'azureLogAnalytics';
    this.optionsKey = optionsKey;
  }

  query(options: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponseData> {
    const byType: Record<AzureQueryType, DataQueryRequest<AzureMonitorQuery>> = ({} as unknown) as Record<
      AzureQueryType,
      DataQueryRequest<AzureMonitorQuery>
    >;

    for (const target of options.targets) {
      // Migrate old query structure
      if (target.queryType === AzureQueryType.ApplicationInsights) {
        if ((target.appInsights as any).rawQuery) {
          target.queryType = AzureQueryType.InsightsAnalytics;
          target.insightsAnalytics = (target.appInsights as unknown) as InsightsAnalyticsQuery;
          delete target.appInsights;
        }
      }
      if (!target.queryType) {
        target.queryType = AzureQueryType.AzureMonitor;
      }

      if (target.queryType === AzureQueryType.AzureMonitor) {
        migrateMetricsDimensionFilters(target.azureMonitor);
      }

      // Check that we have options
      const opts = (target as any)[this.optionsKey[target.queryType]];

      // Skip hidden queries or ones without properties
      if (target.hide || !opts) {
        continue;
      }

      // Initalize the list of queries
      let q = byType[target.queryType];
      if (!q) {
        q = _.cloneDeep(options);
        q.targets = [];
        byType[target.queryType] = q;
      }
      q.targets.push(target);
    }

    // Distinct types are managed by distinct requests
    const obs = Object.keys(byType).map((type: AzureQueryType) => {
      const req = byType[type];
      return this.pseudoDatasource[type].query(req);
    });
    // Single query can skip merge
    if (obs.length === 1) {
      return obs[0];
    }
    if (obs.length > 1) {
      // Not accurate, but simple and works
      // should likely be more like the mixed data source
      const promises = obs.map(o => o.toPromise());
      return from(
        Promise.all(promises).then(results => {
          return { data: _.flatten(results) };
        })
      );
    }
    return of({ state: LoadingState.Done });
  }

  async annotationQuery(options: any) {
    return this.azureLogAnalyticsDatasource.annotationQuery(options);
  }

  async metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    const aiResult = this.appInsightsDatasource.metricFindQuery(query);
    if (aiResult) {
      return aiResult;
    }

    const amResult = this.azureMonitorDatasource.metricFindQuery(query);
    if (amResult) {
      return amResult;
    }

    const alaResult = this.azureLogAnalyticsDatasource.metricFindQuery(query);
    if (alaResult) {
      return alaResult;
    }

    return Promise.resolve([]);
  }

  async testDatasource() {
    const promises: any[] = [];

    if (this.azureMonitorDatasource.isConfigured()) {
      promises.push(this.azureMonitorDatasource.testDatasource());
    }

    if (this.appInsightsDatasource.isConfigured()) {
      promises.push(this.appInsightsDatasource.testDatasource());
    }

    if (this.azureLogAnalyticsDatasource.isConfigured()) {
      promises.push(this.azureLogAnalyticsDatasource.testDatasource());
    }

    if (promises.length === 0) {
      return {
        status: 'error',
        message: `Nothing configured. At least one of the API's must be configured.`,
        title: 'Error',
      };
    }

    return Promise.all(promises).then(results => {
      let status = 'success';
      let message = '';

      for (let i = 0; i < results.length; i++) {
        if (results[i].status !== 'success') {
          status = results[i].status;
        }
        message += `${i + 1}. ${results[i].message} `;
      }

      return {
        status: status,
        message: message,
        title: _.upperFirst(status),
      };
    });
  }

  /* Azure Monitor REST API methods */
  getResourceGroups(subscriptionId: string) {
    return this.azureMonitorDatasource.getResourceGroups(subscriptionId);
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    return this.azureMonitorDatasource.getMetricDefinitions(subscriptionId, resourceGroup);
  }

  getResourceNames(subscriptionId: string, resourceGroup: string, metricDefinition: string) {
    return this.azureMonitorDatasource.getResourceNames(subscriptionId, resourceGroup, metricDefinition);
  }

  getMetricNames(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string
  ) {
    return this.azureMonitorDatasource.getMetricNames(
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace
    );
  }

  getMetricNamespaces(subscriptionId: string, resourceGroup: string, metricDefinition: string, resourceName: string) {
    return this.azureMonitorDatasource.getMetricNamespaces(
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName
    );
  }

  getMetricMetadata(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string,
    metricName: string
  ) {
    return this.azureMonitorDatasource.getMetricMetadata(
      subscriptionId,
      resourceGroup,
      metricDefinition,
      resourceName,
      metricNamespace,
      metricName
    );
  }

  /* Application Insights API method */
  getAppInsightsMetricNames() {
    return this.appInsightsDatasource.getMetricNames();
  }

  getAppInsightsMetricMetadata(metricName: string) {
    return this.appInsightsDatasource.getMetricMetadata(metricName);
  }

  getAppInsightsColumns(refId: string | number) {
    return this.appInsightsDatasource.logAnalyticsColumns[refId];
  }

  /*Azure Log Analytics */
  getAzureLogAnalyticsWorkspaces(subscriptionId: string) {
    return this.azureLogAnalyticsDatasource.getWorkspaces(subscriptionId);
  }

  getSubscriptions() {
    return this.azureMonitorDatasource.getSubscriptions();
  }
}
