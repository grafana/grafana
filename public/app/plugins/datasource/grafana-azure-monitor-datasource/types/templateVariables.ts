export type GrafanaTemplateVariableQueryType =
  | 'AppInsightsMetricNameQuery'
  | 'AppInsightsGroupByQuery'
  | 'SubscriptionsQuery'
  | 'ResourceGroupsQuery'
  | 'MetricDefinitionsQuery'
  | 'ResourceNamesQuery'
  | 'MetricNamespaceQuery'
  | 'MetricNamesQuery'
  | 'WorkspacesQuery'
  | 'UnknownQuery';

interface BaseGrafanaTemplateVariableQuery {
  rawQuery?: string;
}

export interface UnknownQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'UnknownQuery';
}
export interface AppInsightsMetricNameQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'AppInsightsMetricNameQuery';
}
export interface AppInsightsGroupByQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'AppInsightsGroupByQuery';
  metricName: string;
}
export interface SubscriptionsQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'SubscriptionsQuery';
}
export interface ResourceGroupsQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'ResourceGroupsQuery';
  subscription: string;
}
export interface MetricDefinitionsQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'MetricDefinitionsQuery';
  subscription: string;
  resourceGroup: string;
}
export interface ResourceNamesQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'ResourceNamesQuery';
  subscription: string;
  resourceGroup: string;
  metricDefinition: string;
}
export interface MetricNamespaceQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'MetricNamespaceQuery';
  subscription: string;
  resourceGroup: string;
  metricDefinition: string;
  resourceName: string;
}
export interface MetricNamesQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'MetricNamesQuery';
  subscription: string;
  resourceGroup: string;
  metricDefinition: string;
  resourceName: string;
  metricNamespace: string;
}
export interface WorkspacesQuery extends BaseGrafanaTemplateVariableQuery {
  kind: 'WorkspacesQuery';
  subscription: string;
}

export type GrafanaTemplateVariableQuery =
  | AppInsightsMetricNameQuery
  | AppInsightsGroupByQuery
  | SubscriptionsQuery
  | ResourceGroupsQuery
  | MetricDefinitionsQuery
  | ResourceNamesQuery
  | MetricNamespaceQuery
  | MetricNamesQuery
  | WorkspacesQuery
  | UnknownQuery;
