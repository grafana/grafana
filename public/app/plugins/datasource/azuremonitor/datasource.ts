import { cloneDeep } from 'lodash';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { AadCurrentUserCredentials, instanceOfAzureCredential, isCredentialsComplete } from '@grafana/azure-sdk';
import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  QueryFixAction,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, TemplateSrv } from '@grafana/runtime';

import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import { AzureMonitorDataSourceJsonData, AzureMonitorQuery, AzureQueryType } from './types';
import migrateAnnotation from './utils/migrateAnnotation';
import migrateQuery from './utils/migrateQuery';
import { VariableSupport } from './variables';

export default class Datasource extends DataSourceWithBackend<AzureMonitorQuery, AzureMonitorDataSourceJsonData> {
  annotations = {
    prepareAnnotation: migrateAnnotation,
  };

  azureMonitorDatasource: AzureMonitorDatasource;
  azureLogAnalyticsDatasource: AzureLogAnalyticsDatasource;
  resourcePickerData: ResourcePickerData;
  azureResourceGraphDatasource: AzureResourceGraphDatasource;
  currentUserAuth: boolean;
  currentUserAuthFallbackAvailable: boolean;

  pseudoDatasource: {
    [key in AzureQueryType]?: AzureMonitorDatasource | AzureLogAnalyticsDatasource | AzureResourceGraphDatasource;
  } = {};

  declare optionsKey: Record<AzureQueryType, string>;

  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureMonitorDataSourceJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
    this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
    this.azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
    this.resourcePickerData = new ResourcePickerData(instanceSettings, this.azureMonitorDatasource);

    this.pseudoDatasource = {
      [AzureQueryType.AzureMonitor]: this.azureMonitorDatasource,
      [AzureQueryType.LogAnalytics]: this.azureLogAnalyticsDatasource,
      [AzureQueryType.AzureResourceGraph]: this.azureResourceGraphDatasource,
      [AzureQueryType.AzureTraces]: this.azureLogAnalyticsDatasource,
    };

    this.variables = new VariableSupport(this);

    const credentials = instanceSettings.jsonData.azureCredentials;
    if (credentials && instanceOfAzureCredential<AadCurrentUserCredentials>('currentuser', credentials)) {
      this.currentUserAuth = true;
      if (!credentials.serviceCredentials) {
        this.currentUserAuthFallbackAvailable = false;
      } else {
        this.currentUserAuthFallbackAvailable = isCredentialsComplete(credentials.serviceCredentials, true);
      }
    } else {
      // Handle legacy credentials case
      this.currentUserAuth = instanceSettings.jsonData.azureAuthType === 'currentuser';
      this.currentUserAuthFallbackAvailable = false;
    }
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    if (!item.queryType) {
      return false;
    }

    const query = migrateQuery(item);
    const ds = this.pseudoDatasource[item.queryType];
    return ds?.filterQuery?.(query) ?? true;
  }

  query(options: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    const byType = new Map<AzureQueryType, DataQueryRequest<AzureMonitorQuery>>();

    for (const baseTarget of options.targets) {
      // Migrate old query structures
      const target = migrateQuery(baseTarget);

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
      let mappedQueryType = queryType;
      if (queryType === AzureQueryType.AzureTraces || queryType === AzureQueryType.TraceExemplar) {
        mappedQueryType = AzureQueryType.LogAnalytics;
      }

      const ds = this.pseudoDatasource[mappedQueryType];
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

  targetContainsTemplate(query: AzureMonitorQuery) {
    if (query.subscription && this.templateSrv.containsTemplate(query.subscription)) {
      return true;
    }

    let subQuery;
    if (query.queryType === AzureQueryType.AzureMonitor) {
      subQuery = JSON.stringify(query.azureMonitor);
    } else if (query.queryType === AzureQueryType.LogAnalytics) {
      subQuery = JSON.stringify(query.azureLogAnalytics);
    } else if (query.queryType === AzureQueryType.AzureResourceGraph) {
      subQuery = JSON.stringify([query.azureResourceGraph, query.subscriptions]);
    }

    return !!subQuery && this.templateSrv.containsTemplate(subQuery);
  }

  /* Azure Monitor REST API methods */
  getResourceGroups(subscriptionId: string) {
    return this.azureMonitorDatasource.getResourceGroups(this.templateSrv.replace(subscriptionId));
  }

  getMetricNamespaces(subscriptionId: string, resourceGroup?: string, resourceUri?: string, custom?: boolean) {
    let url = `/subscriptions/${subscriptionId}`;
    if (resourceGroup) {
      url += `/resourceGroups/${resourceGroup}`;
    }
    if (resourceUri) {
      url = resourceUri;
    }
    return this.azureMonitorDatasource.getMetricNamespaces(
      { resourceUri: url },
      // If custom namespaces are being queried we do not issue the query against the global region
      // as resources have a specific region
      custom ? false : true,
      undefined,
      custom
    );
  }

  getResourceNames(subscriptionId: string, resourceGroup?: string, metricNamespace?: string, region?: string) {
    return this.azureMonitorDatasource.getResourceNames({ subscriptionId, resourceGroup, metricNamespace, region });
  }

  getMetricNames(
    subscriptionId: string,
    resourceGroup: string,
    metricNamespace: string,
    resourceName: string,
    customNamespace?: string
  ) {
    return this.azureMonitorDatasource.getMetricNames({
      subscription: subscriptionId,
      resourceGroup,
      metricNamespace,
      resourceName,
      customNamespace,
    });
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

      const queryType = query.queryType === AzureQueryType.AzureTraces ? AzureQueryType.LogAnalytics : query.queryType;
      const ds = this.pseudoDatasource[queryType];
      return {
        datasource: ds?.getRef(),
        ...(ds?.applyTemplateVariables(query, scopedVars) ?? query),
      };
    });

    return mapped;
  }

  getVariables() {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }

  getVariablesRaw() {
    return this.templateSrv.getVariables();
  }

  modifyQuery(query: AzureMonitorQuery, action: QueryFixAction): AzureMonitorQuery {
    if (!action.options) {
      return query;
    }
    let expression = query.azureLogAnalytics?.query;
    if (expression === undefined) {
      return query;
    }
    switch (action.type) {
      case 'ADD_FILTER': {
        expression += `\n| where ${action.options.key} == "${action.options.value}"`;
        break;
      }
      case 'ADD_FILTER_OUT': {
        expression += `\n| where ${action.options.key} != "${action.options.value}"`;
        break;
      }
    }
    return { ...query, azureLogAnalytics: { ...query.azureLogAnalytics, query: expression } };
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

    case AzureQueryType.AzureTraces:
    case AzureQueryType.TraceExemplar:
      return !!query.azureTraces;

    case AzureQueryType.GrafanaTemplateVariableFn:
      return !!query.grafanaTemplateVariableFn;

    default:
      return false;
  }
}
