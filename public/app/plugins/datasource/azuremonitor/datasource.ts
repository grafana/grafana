import { cloneDeep } from 'lodash';
import { forkJoin, type Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { type AadCurrentUserCredentials, instanceOfAzureCredential, isCredentialsComplete } from '@grafana/azure-sdk';
import {
  type DataFrame,
  type DataQueryRequest,
  type DataQueryResponse,
  type DataSourceInstanceSettings,
  LoadingState,
  type QueryFixAction,
  type ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend, getTemplateSrv, type TemplateSrv } from '@grafana/runtime';

import AzureHealthModelsDatasource from './azure_health_models/azure_health_models_datasource';
import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import { AzureQueryType } from './dataquery.gen';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import { type AzureMonitorQuery } from './types/query';
import { type AzureMonitorDataSourceJsonData } from './types/types';
import migrateAnnotation from './utils/migrateAnnotation';
import migrateQuery from './utils/migrateQuery';
import { AZURE_HEALTH_MODELS_SERVICE, type AzureMonitorService, getAzureMonitorService } from './utils/queryUtils';
import { VariableSupport } from './variables';

export default class Datasource extends DataSourceWithBackend<AzureMonitorQuery, AzureMonitorDataSourceJsonData> {
  annotations = {
    prepareAnnotation: migrateAnnotation,
  };

  azureMonitorDatasource: AzureMonitorDatasource;
  azureLogAnalyticsDatasource: AzureLogAnalyticsDatasource;
  resourcePickerData: ResourcePickerData;
  azureResourceGraphDatasource: AzureResourceGraphDatasource;
  azureHealthModelsDatasource: AzureHealthModelsDatasource;
  currentUserAuth: boolean;
  currentUserAuthFallbackAvailable: boolean;
  defaultSubscriptionId?: string;

  pseudoDatasource: {
    [key in AzureMonitorService]?:
      | AzureMonitorDatasource
      | AzureLogAnalyticsDatasource
      | AzureResourceGraphDatasource
      | AzureHealthModelsDatasource;
  } = {};

  declare optionsKey: Record<AzureMonitorService, string>;

  constructor(
    instanceSettings: DataSourceInstanceSettings<AzureMonitorDataSourceJsonData>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv()
  ) {
    super(instanceSettings);
    this.azureMonitorDatasource = new AzureMonitorDatasource(instanceSettings);
    this.azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
    this.azureLogAnalyticsDatasource = new AzureLogAnalyticsDatasource(instanceSettings);
    this.azureHealthModelsDatasource = new AzureHealthModelsDatasource(instanceSettings);
    this.resourcePickerData = new ResourcePickerData(
      instanceSettings,
      this.azureMonitorDatasource,
      this.azureResourceGraphDatasource
    );

    this.pseudoDatasource = {
      [AzureQueryType.AzureMonitor]: this.azureMonitorDatasource,
      [AzureQueryType.LogAnalytics]: this.azureLogAnalyticsDatasource,
      [AzureQueryType.AzureResourceGraph]: this.azureResourceGraphDatasource,
      [AzureQueryType.AzureTraces]: this.azureLogAnalyticsDatasource,
      [AZURE_HEALTH_MODELS_SERVICE]: this.azureHealthModelsDatasource,
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

    this.defaultSubscriptionId = instanceSettings.jsonData.subscriptionId;
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    const service = getAzureMonitorService(item);
    if (!service) {
      return false;
    }

    const query = migrateQuery(item);
    const ds = this.pseudoDatasource[service];
    return ds?.filterQuery?.(query) ?? true;
  }

  query(options: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    const byService = new Map<AzureMonitorService, DataQueryRequest<AzureMonitorQuery>>();

    for (const baseTarget of options.targets) {
      // Migrate old query structures
      const target = migrateQuery(baseTarget);
      const service = getAzureMonitorService(target);

      // Skip hidden or invalid queries, or ones without properties
      if (!service || target.hide || !hasQueryForService(target)) {
        continue;
      }

      // Initialize the list of queries
      if (!byService.has(service)) {
        const queryForService = cloneDeep(options);
        queryForService.requestId = `${queryForService.requestId}-${target.refId}`;
        queryForService.targets = [];
        byService.set(service, queryForService);
      }

      byService.get(service)?.targets.push(target);
    }

    const observables: Array<Observable<DataQueryResponse>> = Array.from(byService.entries()).map(([service, req]) => {
      let mappedService = service;
      if (service === AzureQueryType.AzureTraces || service === AzureQueryType.TraceExemplar) {
        mappedService = AzureQueryType.LogAnalytics;
      }

      const ds = this.pseudoDatasource[mappedService];
      if (!ds) {
        throw new Error('Data source not created for service ' + service);
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
    } else if (getAzureMonitorService(query) === AZURE_HEALTH_MODELS_SERVICE) {
      subQuery = JSON.stringify(query.azureHealthModels);
    }

    return !!subQuery && this.templateSrv.containsTemplate(subQuery);
  }

  /* Azure Monitor REST API methods */
  getMetricNamespaces(
    subscriptionId: string,
    resourceGroup?: string,
    resourceUri?: string,
    custom?: boolean,
    variableQuery?: boolean
  ) {
    let url = `/subscriptions/${subscriptionId}`;
    if (resourceGroup) {
      url += `/resourceGroups/${resourceGroup}`;
    }
    if (resourceUri) {
      url = resourceUri;
    }

    // For variable queries it's more efficient to use resource graph
    // Using resource graph allows us to return namespaces irrespective of a users permissions
    // This also ensure the returned namespaces are filtered to the selected resource group when specified
    if (variableQuery) {
      return this.azureResourceGraphDatasource.getMetricNamespaces(url);
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

  getSubscriptions() {
    return this.azureMonitorDatasource.getSubscriptions();
  }

  /*Azure Log Analytics */
  getAzureLogAnalyticsWorkspaces(subscriptionId: string) {
    return this.azureLogAnalyticsDatasource.getWorkspaces(subscriptionId);
  }

  /*Azure Resource Graph */
  getResourceGroups(subscriptionId: string) {
    return this.azureResourceGraphDatasource.getResourceGroups(this.templateSrv.replace(subscriptionId));
  }

  getResourceNames(subscriptionId: string, resourceGroup?: string, metricNamespace?: string, region?: string) {
    return this.azureResourceGraphDatasource.getResourceNames({
      subscriptionId,
      resourceGroup,
      metricNamespace,
      region,
    });
  }

  getLocations(subscriptions: string[]) {
    return this.azureMonitorDatasource.getLocations(subscriptions);
  }

  interpolateVariablesInQueries(queries: AzureMonitorQuery[], scopedVars: ScopedVars): AzureMonitorQuery[] {
    const mapped = queries.map((query) => {
      const service = getAzureMonitorService(query);
      if (!service) {
        return query;
      }

      const mappedService = service === AzureQueryType.AzureTraces ? AzureQueryType.LogAnalytics : service;
      const ds = this.pseudoDatasource[mappedService];
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

  getDefaultSubscriptionId() {
    return this.defaultSubscriptionId || '';
  }
}

function hasQueryForService(query: AzureMonitorQuery): boolean {
  if (getAzureMonitorService(query) === AZURE_HEALTH_MODELS_SERVICE) {
    return !!query.azureHealthModels?.healthModelId;
  }

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
