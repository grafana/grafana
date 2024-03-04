import { BusEventBase, BusEventWithPayload } from '@grafana/data';
import { ConstantVariable, SceneObject } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export type ActionViewType = 'overview' | 'breakdown' | 'logs' | 'related';
export interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  getScene: () => SceneObject;
}

export const TRAILS_ROUTE = '/explore/metrics/trail';

export const VAR_METRIC_NAMES = 'metricNames';
export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '{${filters}}';
export const VAR_METRIC = 'metric';
export const VAR_METRIC_EXPR = '${metric}';
export const VAR_GROUP_BY = 'groupby';
export const VAR_GROUP_BY_EXP = '${groupby}';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_DATASOURCE = 'logsDs';
export const VAR_LOGS_DATASOURCE_EXPR = '${logsDs}';

export const LOGS_METRIC = '$__logs__';
export const KEY_SQR_METRIC_VIZ_QUERY = 'sqr-metric-viz-query';

export const trailDS = { uid: VAR_DATASOURCE_EXPR };

// Local storage keys
export const RECENT_TRAILS_KEY = 'grafana.trails.recent';
export const BOOKMARKED_TRAILS_KEY = 'grafana.trails.bookmarks';

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

export class MetricSelectedEvent extends BusEventWithPayload<string> {
  public static type = 'metric-selected-event';
}

export class OpenEmbeddedTrailEvent extends BusEventBase {
  public static type = 'open-embedded-trail-event';
}
