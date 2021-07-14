import { cloneDeep, upperFirst } from 'lodash';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AppInsightsDatasource from './app_insights/app_insights_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import {
  AzureDataSourceJsonData,
  AzureMonitorQuery,
  AzureQueryType,
  DatasourceValidationResult,
  InsightsAnalyticsQuery,
} from './types';
import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  LoadingState,
  ScopedVars,
} from '@grafana/data';
import { forkJoin, Observable, of } from 'rxjs';
import { getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import InsightsAnalyticsDatasource from './insights_analytics/insights_analytics_datasource';
import { migrateMetricsDimensionFilters } from './query_ctrl';
import { map } from 'rxjs/operators';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import { getAzureCloud } from './credentials';

export default class Datasource extends DataSourceApi<AzureMonitorQuery, AzureDataSourceJsonData> {
  azureMonitorDatasource: AzureMonitorDatasource;
  azureLogAnalyticsDatasource: AzureLogAnalyticsDatasource;
  resourcePickerData: ResourcePickerData;
  azureResourceGraphDatasource: AzureResourceGraphDatasource;
  /** @deprecated */
  appInsightsDatasource?: AppInsightsDatasource;
  /** @deprecated */
  insightsAnalyticsDatasource?: InsightsAnalyticsDatasource;

  pseudoDatasource: {
    [key in AzureQueryType]?:
      | AzureMonitorDatasource
      | AzureLogAnalyticsDatasource
      | AzureResourceGraphDatasource
      | AppInsightsDatasource
      | InsightsAnalyticsDatasource;
  } = {};

  optionsKey: Record<AzureQueryType, string>;

  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureDataSourceJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
    this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
    this.azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
    this.resourcePickerData = new ResourcePickerData(instanceSettings);

    this.pseudoDatasource = {
      [AzureQueryType.AzureMonitor]: this.azureMonitorDatasource,
      [AzureQueryType.LogAnalytics]: this.azureLogAnalyticsDatasource,
      [AzureQueryType.AzureResourceGraph]: this.azureResourceGraphDatasource,
    };

    const cloud = getAzureCloud(instanceSettings);
    if (cloud === 'azuremonitor' || cloud === 'chinaazuremonitor') {
      // AppInsights and InsightAnalytics are only supported for Public and Azure China clouds
      this.appInsightsDatasource = new AppInsightsDatasource(instanceSettings);
      this.insightsAnalyticsDatasource = new InsightsAnalyticsDatasource(instanceSettings);
      this.pseudoDatasource[AzureQueryType.ApplicationInsights] = this.appInsightsDatasource;
      this.pseudoDatasource[AzureQueryType.InsightsAnalytics] = this.insightsAnalyticsDatasource;
    }
  }

  query(options: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    console.log('query options.targets', options.targets);

    const byType = new Map<AzureQueryType, DataQueryRequest<AzureMonitorQuery>>();

    for (const target of options.targets) {
      // Migrate old query structure
      migrateQuery(target);

      // Skip hidden or invalid queries or ones without properties
      if (!target.queryType || target.hide || !hasQueryForType(target)) {
        continue;
      }

      // Initialize the list of queries
      if (!byType.has(target.queryType)) {
        const queryForType = cloneDeep(options);
        queryForType.requestId = `${queryForType.requestId}-${target.refId}`;
        queryForType.targets = [];
        byType.set(target.queryType, queryForType);
      }

      const queryForType = byType.get(target.queryType);
      queryForType?.targets.push(target);
    }

    const observables: Array<Observable<DataQueryResponse>> = Array.from(byType.entries()).map(([queryType, req]) => {
      const ds = this.pseudoDatasource[queryType];
      if (!ds) {
        throw new Error('Data source not created for query type ' + queryType);
      }

      return ds.query(req);
    });

    // Single query can skip merge
    if (observables.length === 1) {
      return observables[0];
    }

    if (observables.length > 1) {
      return forkJoin(observables).pipe(
        map((results: DataQueryResponse[]) => {
          const data: DataFrame[] = [];
          for (const result of results) {
            for (const frame of result.data) {
              data.push(frame);
            }
          }

          return { state: LoadingState.Done, data };
        })
      );
    }

    return of({ state: LoadingState.Done, data: [] });
  }

  async annotationQuery(options: any) {
    return this.azureLogAnalyticsDatasource.annotationQuery(options);
  }

  async metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    const aiResult = this.appInsightsDatasource?.metricFindQueryInternal(query);
    if (aiResult) {
      return aiResult;
    }

    const amResult = this.azureMonitorDatasource.metricFindQueryInternal(query);
    if (amResult) {
      return amResult;
    }

    const alaResult = this.azureLogAnalyticsDatasource.metricFindQueryInternal(query);
    if (alaResult) {
      return alaResult;
    }

    return Promise.resolve([]);
  }

  async testDatasource(): Promise<DatasourceValidationResult> {
    const promises: Array<Promise<DatasourceValidationResult>> = [];

    promises.push(this.azureMonitorDatasource.testDatasource());
    promises.push(this.azureLogAnalyticsDatasource.testDatasource());

    if (this.appInsightsDatasource?.isConfigured()) {
      promises.push(this.appInsightsDatasource.testDatasource());
    }

    return await Promise.all(promises).then((results) => {
      let status: 'success' | 'error' = 'success';
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
        title: upperFirst(status),
      };
    });
  }

  /* Azure Monitor REST API methods */
  getResourceGroups(subscriptionId: string) {
    return this.azureMonitorDatasource.getResourceGroups(this.replaceTemplateVariable(subscriptionId));
  }

  getMetricDefinitions(subscriptionId: string, resourceGroup: string) {
    return this.azureMonitorDatasource.getMetricDefinitions(
      this.replaceTemplateVariable(subscriptionId),
      this.replaceTemplateVariable(resourceGroup)
    );
  }

  getResourceNames(subscriptionId: string, resourceGroup: string, metricDefinition: string) {
    return this.azureMonitorDatasource.getResourceNames(
      this.replaceTemplateVariable(subscriptionId),
      this.replaceTemplateVariable(resourceGroup),
      this.replaceTemplateVariable(metricDefinition)
    );
  }

  getMetricNames(
    subscriptionId: string,
    resourceGroup: string,
    metricDefinition: string,
    resourceName: string,
    metricNamespace: string
  ) {
    return this.azureMonitorDatasource.getMetricNames(
      this.replaceTemplateVariable(subscriptionId),
      this.replaceTemplateVariable(resourceGroup),
      this.replaceTemplateVariable(metricDefinition),
      this.replaceTemplateVariable(resourceName),
      this.replaceTemplateVariable(metricNamespace)
    );
  }

  getMetricNamespaces(subscriptionId: string, resourceGroup: string, metricDefinition: string, resourceName: string) {
    return this.azureMonitorDatasource.getMetricNamespaces(
      this.replaceTemplateVariable(subscriptionId),
      this.replaceTemplateVariable(resourceGroup),
      this.replaceTemplateVariable(metricDefinition),
      this.replaceTemplateVariable(resourceName)
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
      this.replaceTemplateVariable(subscriptionId),
      this.replaceTemplateVariable(resourceGroup),
      this.replaceTemplateVariable(metricDefinition),
      this.replaceTemplateVariable(resourceName),
      this.replaceTemplateVariable(metricNamespace),
      this.replaceTemplateVariable(metricName)
    );
  }

  /* Application Insights API method */
  getAppInsightsMetricNames() {
    return this.appInsightsDatasource?.getMetricNames();
  }

  getAppInsightsMetricMetadata(metricName: string) {
    return this.appInsightsDatasource?.getMetricMetadata(metricName);
  }

  getAppInsightsColumns(refId: string | number) {
    return this.appInsightsDatasource?.logAnalyticsColumns[refId];
  }

  /*Azure Log Analytics */
  getAzureLogAnalyticsWorkspaces(subscriptionId: string) {
    return this.azureLogAnalyticsDatasource.getWorkspaces(subscriptionId);
  }

  getSubscriptions() {
    return this.azureMonitorDatasource.getSubscriptions();
  }

  interpolateVariablesInQueries(queries: AzureMonitorQuery[], scopedVars: ScopedVars): AzureMonitorQuery[] {
    const mapped = queries.map((query) => {
      if (!query.queryType) {
        return query;
      }

      const ds = this.pseudoDatasource[query.queryType];
      return ds?.applyTemplateVariables(query, scopedVars) ?? query;
    });

    return mapped;
  }

  replaceTemplateVariable(variable: string) {
    return this.templateSrv.replace(variable);
  }

  getVariables() {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }
}

function migrateQuery(target: AzureMonitorQuery) {
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

  if (target.queryType === AzureQueryType.AzureMonitor && target.azureMonitor) {
    migrateMetricsDimensionFilters(target.azureMonitor);
  }
}

function hasQueryForType(query: AzureMonitorQuery): boolean {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return !!query.azureMonitor;

    case AzureQueryType.LogAnalytics:
      return !!query.azureLogAnalytics;

    case AzureQueryType.AzureResourceGraph:
      return !!query.azureResourceGraph;

    case AzureQueryType.ApplicationInsights:
      return !!query.appInsights;

    case AzureQueryType.InsightsAnalytics:
      return !!query.insightsAnalytics;

    default:
      return false;
  }
}
