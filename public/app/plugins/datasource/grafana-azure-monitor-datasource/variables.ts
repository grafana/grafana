import { from, Observable } from 'rxjs';
import {
  CustomVariableSupport,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  toDataFrame,
} from '@grafana/data';
import VariableEditor from './components/VariableEditor/VariableEditor';
import DataSource from './datasource';
import { AzureMonitorQuery, AzureQueryType } from './types';
import { getTemplateSrv } from '@grafana/runtime';
import { grafanaTemplateVariableFnMatches, migrateStringQueriesToObjectQueries } from './grafanaTemplateVariableFns';

export class VariableSupport extends CustomVariableSupport<DataSource, AzureMonitorQuery> {
  constructor(private readonly datasource: DataSource) {
    super();
    this.datasource = datasource;
    this.query = this.query.bind(this);
  }

  editor = VariableEditor;

  query(request: DataQueryRequest<AzureMonitorQuery>): Observable<DataQueryResponse> {
    request.targets = request.targets.map((target) => {
      return migrateStringQueriesToObjectQueries(target, { datasource: this.datasource });
    });

    if (
      request.targets[0].queryType === AzureQueryType.GrafanaTemplateVariableFn &&
      request.targets[0].grafanaTemplateVariableFn?.query
    ) {
      return this.queryForGrafanaTemplateVariableFn(request.targets[0].grafanaTemplateVariableFn?.query);
    }

    return this.datasource.query(request);
  }

  queryForGrafanaTemplateVariableFn(query: string) {
    const promisedResults = async () => {
      const templateVariablesResults = await this.callGrafanaTemplateVariableFn(query);
      return {
        data: templateVariablesResults ? [toDataFrame(templateVariablesResults)] : [],
      };
    };
    return from(promisedResults());
  }

  callGrafanaTemplateVariableFn(query: string): Promise<MetricFindValue[]> | null {
    const matchesForQuery = grafanaTemplateVariableFnMatches(query);
    const defaultSubscriptionId = this.datasource.azureLogAnalyticsDatasource.defaultSubscriptionId;

    // deprecated app insights template variables (will most likely remove in grafana 9)
    if (this.datasource.insightsAnalyticsDatasource) {
      if (matchesForQuery.appInsightsMetricNameQuery) {
        return this.datasource.insightsAnalyticsDatasource.getMetricNames();
      }

      if (matchesForQuery.appInsightsGroupByQuery) {
        const metricName = matchesForQuery.appInsightsGroupByQuery[1];
        return this.datasource.insightsAnalyticsDatasource.getGroupBys(getTemplateSrv().replace(metricName));
      }
    }

    if (matchesForQuery.subscriptions) {
      return this.datasource.getSubscriptions();
    }

    if (matchesForQuery.resourceGroups && defaultSubscriptionId) {
      return this.datasource.getResourceGroups(defaultSubscriptionId);
    }

    if (matchesForQuery.resourceGroupsWithSub) {
      return this.datasource.getResourceGroups(this.toVariable(matchesForQuery.resourceGroupsWithSub[1]));
    }

    if (matchesForQuery.metricDefinitions && defaultSubscriptionId) {
      if (!matchesForQuery.metricDefinitions[3]) {
        return this.datasource.getMetricDefinitions(
          defaultSubscriptionId,
          this.toVariable(matchesForQuery.metricDefinitions[1])
        );
      }
    }

    if (matchesForQuery.metricDefinitionsWithSub) {
      return this.datasource.getMetricDefinitions(
        this.toVariable(matchesForQuery.metricDefinitionsWithSub[1]),
        this.toVariable(matchesForQuery.metricDefinitionsWithSub[2])
      );
    }

    if (matchesForQuery.resourceNames && defaultSubscriptionId) {
      const resourceGroup = this.toVariable(matchesForQuery.resourceNames[1]);
      const metricDefinition = this.toVariable(matchesForQuery.resourceNames[2]);
      return this.datasource.getResourceNames(defaultSubscriptionId, resourceGroup, metricDefinition);
    }

    if (matchesForQuery.resourceNamesWithSub) {
      const subscription = this.toVariable(matchesForQuery.resourceNamesWithSub[1]);
      const resourceGroup = this.toVariable(matchesForQuery.resourceNamesWithSub[2]);
      const metricDefinition = this.toVariable(matchesForQuery.resourceNamesWithSub[3]);
      return this.datasource.getResourceNames(subscription, resourceGroup, metricDefinition);
    }

    if (matchesForQuery.metricNamespace && defaultSubscriptionId) {
      const resourceGroup = this.toVariable(matchesForQuery.metricNamespace[1]);
      const metricDefinition = this.toVariable(matchesForQuery.metricNamespace[2]);
      const resourceName = this.toVariable(matchesForQuery.metricNamespace[3]);
      return this.datasource.getMetricNamespaces(defaultSubscriptionId, resourceGroup, metricDefinition, resourceName);
    }

    if (matchesForQuery.metricNamespaceWithSub) {
      const subscription = this.toVariable(matchesForQuery.metricNamespaceWithSub[1]);
      const resourceGroup = this.toVariable(matchesForQuery.metricNamespaceWithSub[2]);
      const metricDefinition = this.toVariable(matchesForQuery.metricNamespaceWithSub[3]);
      const resourceName = this.toVariable(matchesForQuery.metricNamespaceWithSub[4]);
      return this.datasource.getMetricNamespaces(subscription, resourceGroup, metricDefinition, resourceName);
    }

    if (matchesForQuery.metricNames && defaultSubscriptionId) {
      if (matchesForQuery.metricNames[3].indexOf(',') === -1) {
        const resourceGroup = this.toVariable(matchesForQuery.metricNames[1]);
        const metricDefinition = this.toVariable(matchesForQuery.metricNames[2]);
        const resourceName = this.toVariable(matchesForQuery.metricNames[3]);
        const metricNamespace = this.toVariable(matchesForQuery.metricNames[4]);
        return this.datasource.getMetricNames(
          defaultSubscriptionId,
          resourceGroup,
          metricDefinition,
          resourceName,
          metricNamespace
        );
      }
    }

    if (matchesForQuery.metricNamesWithSub) {
      const subscription = this.toVariable(matchesForQuery.metricNamesWithSub[1]);
      const resourceGroup = this.toVariable(matchesForQuery.metricNamesWithSub[2]);
      const metricDefinition = this.toVariable(matchesForQuery.metricNamesWithSub[3]);
      const resourceName = this.toVariable(matchesForQuery.metricNamesWithSub[4]);
      const metricNamespace = this.toVariable(matchesForQuery.metricNamesWithSub[5]);
      return this.datasource.getMetricNames(
        subscription,
        resourceGroup,
        metricDefinition,
        resourceName,
        metricNamespace
      );
    }

    if (matchesForQuery.workspacesQuery) {
      if (defaultSubscriptionId) {
        return this.datasource.azureLogAnalyticsDatasource.getWorkspaces(defaultSubscriptionId);
      } else {
        throw new Error(
          'No subscription ID. Specify a default subscription ID in the data source config to use workspaces() without a subscription ID'
        );
      }
    }

    if (matchesForQuery.workspacesQueryWithSub) {
      return this.datasource.azureLogAnalyticsDatasource.getWorkspaces(
        (matchesForQuery.workspacesQueryWithSub[1] || '').trim()
      );
    }

    return null;
  }

  toVariable(metric: string) {
    return getTemplateSrv().replace((metric || '').trim());
  }
}
