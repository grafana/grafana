import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { ConstantVariable, SceneObject } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export type ActionViewType = 'overview' | 'breakdown' | 'related_logs' | 'related';

export interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  description?: string;
  getScene: () => SceneObject;
}

export const TRAILS_ROUTE = '/explore/metrics/trail';
export const HOME_ROUTE = '/explore/metrics';

export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '${filters}';
export const VAR_METRIC = 'metric';
export const VAR_METRIC_EXPR = '${metric}';
export const VAR_GROUP_BY = 'groupby';
export const VAR_GROUP_BY_EXP = '${groupby}';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_DATASOURCE = 'logsDs';
export const VAR_LOGS_DATASOURCE_EXPR = '${logsDs}';
export const VAR_OTEL_RESOURCES = 'otel_resources';
export const VAR_OTEL_RESOURCES_EXPR = '${otel_resources}';
export const VAR_OTEL_DEPLOYMENT_ENV = 'deployment_environment';
export const VAR_OTEL_DEPLOYMENT_ENV_EXPR = '${deployment_environment}';
export const VAR_OTEL_JOIN_QUERY = 'otel_join_query';
export const VAR_OTEL_JOIN_QUERY_EXPR = '${otel_join_query}';
export const VAR_OTEL_GROUP_BY = 'otel_groupby';
export const VAR_OTEL_GROUP_BY_EXPR = '${otel_groupby}';
export const VAR_OTEL_GROUP_LEFT = 'otel_group_left';
export const VAR_OTEL_GROUP_LEFT_EXPR = '${otel_group_left}';
export const VAR_MISSING_OTEL_TARGETS = 'missing_otel_targets';
export const VAR_MISSING_OTEL_TARGETS_EXPR = '${missing_otel_targets}';

export const LOGS_METRIC = '$__logs__';
export const KEY_SQR_METRIC_VIZ_QUERY = 'sqr-metric-viz-query';

export const trailDS = { uid: VAR_DATASOURCE_EXPR };

// Local storage keys
export const RECENT_TRAILS_KEY = 'grafana.trails.recent';
export const TRAIL_BOOKMARKS_KEY = 'grafana.trails.bookmarks';
export const TRAIL_BREAKDOWN_VIEW_KEY = 'grafana.trails.breakdown.view';
export const TRAIL_BREAKDOWN_SORT_KEY = 'grafana.trails.breakdown.sort';
export const OTEL_EXPERIENCE_ENABLED_KEY = 'grafana.trails.otel.experience.enabled';

export const MDP_METRIC_PREVIEW = 250;
export const MDP_METRIC_OVERVIEW = 500;

export type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function getVariablesWithMetricConstant(metric: string) {
  return [
    new ConstantVariable({
      name: VAR_METRIC,
      value: metric,
      hide: VariableHide.hideVariable,
    }),
  ];
}

export function getVariablesWithOtelJoinQueryConstant(otelJoinQuery: string) {
  return [
    new ConstantVariable({
      name: VAR_OTEL_JOIN_QUERY,
      value: otelJoinQuery,
      hide: VariableHide.hideVariable,
    }),
  ];
}

export class MetricSelectedEvent extends BusEventWithPayload<string | undefined> {
  public static type = 'metric-selected-event';
}

export class RefreshMetricsEvent extends BusEventBase {
  public static type = 'refresh-metrics-event';
}
