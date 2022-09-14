import { cloneDeep } from 'lodash';
import { forkJoin, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  LoadingState,
  ScopedVars,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import AzureLogAnalyticsDatasource from './azure_log_analytics/azure_log_analytics_datasource';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import AzureResourceGraphDatasource from './azure_resource_graph/azure_resource_graph_datasource';
import ResourcePickerData from './resourcePicker/resourcePickerData';
import { AzureDataSourceJsonData, AzureMonitorQuery, AzureQueryType } from './types';
import migrateAnnotation from './utils/migrateAnnotation';
import migrateQuery from './utils/migrateQuery';
import { VariableSupport } from './variables';

export default class Datasource extends DataSourceWithBackend<AzureMonitorQuery, AzureDataSourceJsonData> {
  annotations = {
    prepareAnnotation: migrateAnnotation,
  };

  azureMonitorDatasource: AzureMonitorDatasource;
  azureLogAnalyticsDatasource: AzureLogAnalyticsDatasource;
  resourcePickerData: ResourcePickerData;
  azureResourceGraphDatasource: AzureResourceGraphDatasource;

  pseudoDatasource: {
    [key in AzureQueryType]?: AzureMonitorDatasource | AzureLogAnalyticsDatasource | AzureResourceGraphDatasource;
  } = {};

  declare optionsKey: Record<AzureQueryType, string>;

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

    this.variables = new VariableSupport(this);
  }

  filterQuery(item: AzureMonitorQuery): boolean {
    if (!item.queryType) {
      return true;
    }
    const ds = this.pseudoDatasource[item.queryType];
    return ds?.filterQuery?.(item) ?? true;
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

  async annotationQuery(options: any) {
    return this.azureLogAnalyticsDatasource.annotationQuery(options);
  }

  /* Azure Monitor REST API methods */
  getResourceGroups(subscriptionId: string) {
    return this.azureMonitorDatasource.getResourceGroups(this.templateSrv.replace(subscriptionId));
  }

  getMetricNamespaces(subscriptionId: string, resourceGroup?: string) {
    let url = `/subscriptions/${subscriptionId}`;
    if (resourceGroup) {
      url += `/resourceGroups/${resourceGroup};`;
    }
    return this.azureMonitorDatasource.getMetricNamespaces({ resourceUri: url }, true);
  }

  getResourceNames(subscriptionId: string, resourceGroup?: string, metricNamespace?: string) {
    return this.azureMonitorDatasource.getResourceNames(
      this.templateSrv.replace(subscriptionId),
      this.templateSrv.replace(resourceGroup),
      this.templateSrv.replace(metricNamespace)
    );
  }

  getMetricNames(subscriptionId: string, resourceGroup: string, metricNamespace: string, resourceName: string) {
    return this.azureMonitorDatasource.getMetricNames({
      subscription: subscriptionId,
      resourceGroup,
      metricNamespace,
      resourceName,
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

      const ds = this.pseudoDatasource[query.queryType];
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
}

function hasQueryForType(query: AzureMonitorQuery): boolean {
  switch (query.queryType) {
    case AzureQueryType.AzureMonitor:
      return !!query.azureMonitor;

    case AzureQueryType.LogAnalytics:
      return !!query.azureLogAnalytics;

    case AzureQueryType.AzureResourceGraph:
      return !!query.azureResourceGraph;

    case AzureQueryType.GrafanaTemplateVariableFn:
      return !!query.grafanaTemplateVariableFn;

    default:
      return false;
  }
}
