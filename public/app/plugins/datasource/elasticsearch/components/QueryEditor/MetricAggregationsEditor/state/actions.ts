import { createAction } from '@reduxjs/toolkit';

import { MetricAggregationWithMeta, MetricAggregation, MetricAggregationWithSettings } from '../../../../types';

export const addMetric = createAction<MetricAggregation['id']>('@metrics/add');
export const removeMetric = createAction<MetricAggregation['id']>('@metrics/remove');
export const toggleMetricVisibility = createAction<MetricAggregation['id']>('@metrics/toggle_visibility');
export const changeMetricField = createAction<{ id: MetricAggregation['id']; field: string }>('@metrics/change_field');
export const changeMetricType = createAction<{ id: MetricAggregation['id']; type: MetricAggregation['type'] }>(
  '@metrics/change_type'
);
export const changeMetricAttribute = createAction<{ metric: MetricAggregation; attribute: string; newValue: any }>(
  '@metrics/change_attr'
);
export const changeMetricSetting = createAction<{
  metric: MetricAggregationWithSettings;
  settingName: string;
  newValue: any;
}>('@metrics/change_setting');
export const changeMetricMeta = createAction<{
  metric: MetricAggregationWithMeta;
  meta: string;
  newValue: any;
}>('@metrics/change_meta');
