import { __read } from "tslib";
import React, { useState } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeMetricSetting } from '../state/actions';
import { uniqueId } from 'lodash';
import { getScriptValue } from 'app/plugins/datasource/elasticsearch/utils';
export function SettingField(_a) {
    var label = _a.label, settingName = _a.settingName, metric = _a.metric, placeholder = _a.placeholder, tooltip = _a.tooltip;
    var dispatch = useDispatch();
    var _b = __read(useState(uniqueId("es-field-id-")), 1), id = _b[0];
    var settings = metric.settings;
    var defaultValue = (settings === null || settings === void 0 ? void 0 : settings[settingName]) || '';
    if (settingName === 'script') {
        defaultValue = getScriptValue(metric);
    }
    return (React.createElement(InlineField, { label: label, labelWidth: 16, tooltip: tooltip },
        React.createElement(Input, { id: id, placeholder: placeholder, onBlur: function (e) { return dispatch(changeMetricSetting({ metric: metric, settingName: settingName, newValue: e.target.value })); }, defaultValue: defaultValue })));
}
//# sourceMappingURL=SettingField.js.map