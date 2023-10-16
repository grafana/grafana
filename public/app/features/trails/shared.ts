import { BusEventWithPayload } from '@grafana/data';
import { ConstantVariable, SceneObject, SceneObjectState, SceneVariableSet } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';

export const trailsDS = { uid: 'gdev-prometheus', type: 'prometheus' };

export interface DataTrailActionView<T extends SceneObjectState = SceneObjectState> extends SceneObject<T> {
  getName(): string;
}

export interface ActionViewDefinition {
  displayName: string;
  value: string;
  getScene: () => DataTrailActionView;
}

export const VAR_METRIC_NAMES = 'metricNames';
export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '{${filters}}';
export const VAR_METRIC = 'metric';
export const VAR_METRIC_EXPR = '${metric}';

export type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export function getVariablesWithMetricConstant(metric: string) {
  return new SceneVariableSet({
    variables: [
      new ConstantVariable({
        name: VAR_METRIC,
        value: metric,
        hide: VariableHide.hideVariable,
      }),
    ],
  });
}

export class MetricSelectedEvent extends BusEventWithPayload<string> {
  public static type = 'metric-selected-event';
}
