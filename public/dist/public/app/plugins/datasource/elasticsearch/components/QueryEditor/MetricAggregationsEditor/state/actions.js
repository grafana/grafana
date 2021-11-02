import { createAction } from '@reduxjs/toolkit';
export var addMetric = createAction('@metrics/add');
export var removeMetric = createAction('@metrics/remove');
export var toggleMetricVisibility = createAction('@metrics/toggle_visibility');
export var changeMetricField = createAction('@metrics/change_field');
export var changeMetricType = createAction('@metrics/change_type');
export var changeMetricAttribute = createAction('@metrics/change_attr');
export var changeMetricSetting = createAction('@metrics/change_setting');
export var changeMetricMeta = createAction('@metrics/change_meta');
//# sourceMappingURL=actions.js.map