import React from 'react';
import { PanelPlugin } from '@grafana/data';
import { AlertGroupsPanel } from './AlertGroupsPanel';
import { AlertManagerPicker } from 'app/features/alerting/unified/components/AlertManagerPicker';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
export var plugin = new PanelPlugin(AlertGroupsPanel).setPanelOptions(function (builder) {
    return builder
        .addCustomEditor({
        name: 'Alertmanager',
        path: 'alertmanager',
        id: 'alertmanager',
        defaultValue: GRAFANA_RULES_SOURCE_NAME,
        category: ['Options'],
        editor: function RenderAlertmanagerPicker(props) {
            return (React.createElement(AlertManagerPicker, { current: props.value, onChange: function (alertManagerSourceName) {
                    return props.onChange(alertManagerSourceName);
                } }));
        },
    })
        .addBooleanSwitch({
        name: 'Expand all by default',
        path: 'expandAll',
        defaultValue: false,
        category: ['Options'],
    })
        .addTextInput({
        description: 'Filter results by matching labels, ex: env=production,severity=~critical|warning',
        name: 'Labels',
        path: 'labels',
        category: ['Filter'],
    });
});
//# sourceMappingURL=module.js.map