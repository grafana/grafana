import { from, lastValueFrom, Observable } from 'rxjs';
import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  toDataFrame,
} from '@grafana/data';
import VariableEditor from './components/VariableEditor/VariableEditor';
import DataSource from './datasource';
import { AzureQueryType, AzureMonitorQuery } from './types';
import { getTemplateSrv } from '@grafana/runtime';
import { migrateStringQueriesToObjectQueries } from './grafanaTemplateVariableFns';
import { GrafanaTemplateVariableQuery } from './types/templateVariables';
export class VariableSupport extends CustomVariableSupport<DataSource, AzureMonitorQuery> {
  constructor(private readonly datasource: DataSource) {
    super();
    this.datasource = datasource;
    this.query = this.query.bind(this);
  }

  editor = VariableEditor;

  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    const promisedResults = async () => {
      const queryObj = await migrateStringQueriesToObjectQueries(request.targets[0], { datasource: this.datasource });

      if (
        queryObj.queryType === AzureQueryType.GrafanaTemplateVariableFn &&
        queryObj.grafanaTemplateVariableFn?.rawQuery
      ) {
        const templateVariablesResults = await this.callGrafanaTemplateVariableFn(queryObj.grafanaTemplateVariableFn);
        return {
          data: templateVariablesResults ? [toDataFrame(templateVariablesResults)] : [],
        };
      }
      request.targets[0] = queryObj;
      return lastValueFrom(this.datasource.query(request));
    };

    return from(promisedResults());
  }

  callGrafanaTemplateVariableFn(query: GrafanaTemplateVariableQuery): Promise<MetricFindValue[]> | null {
    // deprecated app insights template variables (will most likely remove in grafana 9)
    if (this.datasource.insightsAnalyticsDatasource) {
      if (query.kind === 'AppInsightsMetricNameQuery') {
        return this.datasource.insightsAnalyticsDatasource.getMetricNames();
      }

      if (query.kind === 'AppInsightsGroupByQuery') {
        return this.datasource.insightsAnalyticsDatasource.getGroupBys(getTemplateSrv().replace(query.metricName));
      }
    }

    if (query.kind === 'SubscriptionsQuery') {
      return this.datasource.getSubscriptions();
    }

    if (query.kind === 'ResourceGroupsQuery') {
      return this.datasource.getResourceGroups(this.toVariable(query.subscription));
    }

    if (query.kind === 'MetricDefinitionsQuery') {
      return this.datasource.getMetricDefinitions(
        this.toVariable(query.subscription),
        this.toVariable(query.resourceGroup)
      );
    }

    if (query.kind === 'ResourceNamesQuery') {
      return this.datasource.getResourceNames(
        this.toVariable(query.subscription),
        this.toVariable(query.resourceGroup),
        this.toVariable(query.metricDefinition)
      );
    }

    if (query.kind === 'MetricNamespaceQuery') {
      return this.datasource.getMetricNamespaces(
        this.toVariable(query.subscription),
        this.toVariable(query.resourceGroup),
        this.toVariable(query.metricDefinition),
        this.toVariable(query.resourceName)
      );
    }

    if (query.kind === 'MetricNamesQuery') {
      return this.datasource.getMetricNames(
        this.toVariable(query.subscription),
        this.toVariable(query.resourceGroup),
        this.toVariable(query.metricDefinition),
        this.toVariable(query.resourceName),
        this.toVariable(query.metricNamespace)
      );
    }

    if (query.kind === 'WorkspacesQuery') {
      return this.datasource.azureLogAnalyticsDatasource.getWorkspaces(query.subscription);
    }

    return null;
  }

  toVariable(metric: string) {
    return getTemplateSrv().replace((metric || '').trim());
  }
}
