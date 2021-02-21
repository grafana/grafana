import { Action } from '../../../../hooks/useStatelessReducer';
import { SettingKeyOf } from '../../../types';
import {
  MetricAggregation,
  MetricAggregationWithMeta,
  MetricAggregationWithSettings,
  MetricAggregationWithField,
} from '../aggregations';

export const ADD_METRIC = '@metrics/add';
export const REMOVE_METRIC = '@metrics/remove';
export const CHANGE_METRIC_TYPE = '@metrics/change_type';
export const CHANGE_METRIC_FIELD = '@metrics/change_field';
export const CHANGE_METRIC_SETTING = '@metrics/change_setting';
export const CHANGE_METRIC_META = '@metrics/change_meta';
export const CHANGE_METRIC_ATTRIBUTE = '@metrics/change_attr';
export const TOGGLE_METRIC_VISIBILITY = '@metrics/toggle_visibility';

export interface AddMetricAction extends Action<typeof ADD_METRIC> {
  payload: {
    id: MetricAggregation['id'];
  };
}

export interface RemoveMetricAction extends Action<typeof REMOVE_METRIC> {
  payload: {
    id: MetricAggregation['id'];
  };
}

export interface ChangeMetricTypeAction extends Action<typeof CHANGE_METRIC_TYPE> {
  payload: {
    id: MetricAggregation['id'];
    type: MetricAggregation['type'];
  };
}

export interface ChangeMetricFieldAction extends Action<typeof CHANGE_METRIC_FIELD> {
  payload: {
    id: MetricAggregation['id'];
    field: MetricAggregationWithField['field'];
  };
}
export interface ToggleMetricVisibilityAction extends Action<typeof TOGGLE_METRIC_VISIBILITY> {
  payload: {
    id: MetricAggregation['id'];
  };
}

export interface ChangeMetricSettingAction<T extends MetricAggregationWithSettings>
  extends Action<typeof CHANGE_METRIC_SETTING> {
  payload: {
    metric: T;
    settingName: SettingKeyOf<T>;
    newValue: unknown;
  };
}

export interface ChangeMetricMetaAction<T extends MetricAggregationWithMeta> extends Action<typeof CHANGE_METRIC_META> {
  payload: {
    metric: T;
    meta: Extract<keyof Required<T>['meta'], string>;
    newValue: string | number | boolean;
  };
}

export interface ChangeMetricAttributeAction<
  T extends MetricAggregation,
  K extends Extract<keyof T, string> = Extract<keyof T, string>
> extends Action<typeof CHANGE_METRIC_ATTRIBUTE> {
  payload: {
    metric: T;
    attribute: K;
    newValue: T[K];
  };
}

type CommonActions =
  | AddMetricAction
  | RemoveMetricAction
  | ChangeMetricTypeAction
  | ChangeMetricFieldAction
  | ToggleMetricVisibilityAction;

export type MetricAggregationAction<T extends MetricAggregation = MetricAggregation> =
  | (T extends MetricAggregationWithSettings ? ChangeMetricSettingAction<T> : never)
  | (T extends MetricAggregationWithMeta ? ChangeMetricMetaAction<T> : never)
  | ChangeMetricAttributeAction<T>
  | CommonActions;
