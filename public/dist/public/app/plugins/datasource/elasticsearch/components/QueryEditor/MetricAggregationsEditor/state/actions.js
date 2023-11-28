import { createAction } from '@reduxjs/toolkit';
export const addMetric = createAction('@metrics/add');
export const removeMetric = createAction('@metrics/remove');
export const toggleMetricVisibility = createAction('@metrics/toggle_visibility');
export const changeMetricField = createAction('@metrics/change_field');
export const changeMetricType = createAction('@metrics/change_type');
export const changeMetricAttribute = createAction('@metrics/change_attr');
export const changeMetricSetting = createAction('@metrics/change_setting');
export const changeMetricMeta = createAction('@metrics/change_meta');
//# sourceMappingURL=actions.js.map