import { uniqueId } from 'lodash';
import React, { useState } from 'react';
import { InlineField, Input } from '@grafana/ui';
import { getScriptValue } from 'app/plugins/datasource/elasticsearch/utils';
import { useDispatch } from '../../../../hooks/useStatelessReducer';
import { changeMetricSetting } from '../state/actions';
export function SettingField({ label, settingName, metric, placeholder, tooltip, }) {
    const dispatch = useDispatch();
    const [id] = useState(uniqueId(`es-field-id-`));
    const settings = metric.settings;
    let defaultValue = (settings === null || settings === void 0 ? void 0 : settings[settingName]) || '';
    if (settingName === 'script') {
        defaultValue = getScriptValue(metric);
    }
    return (React.createElement(InlineField, { label: label, labelWidth: 16, tooltip: tooltip },
        React.createElement(Input, { id: id, placeholder: placeholder, onBlur: (e) => dispatch(changeMetricSetting({ metric, settingName, newValue: e.target.value })), defaultValue: defaultValue })));
}
//# sourceMappingURL=SettingField.js.map