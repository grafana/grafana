import React from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getStyles } from './QuerySettings';
export function ServiceGraphSettings({ options, onOptionsChange }) {
    var _a, _b;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "The Prometheus data source with the service graph data", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { inputId: "service-graph-data-source-picker", pluginId: "prometheus", current: (_a = options.jsonData.serviceMap) === null || _a === void 0 ? void 0 : _a.datasourceUid, noDefault: true, width: 40, onChange: (ds) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
                        datasourceUid: ds.uid,
                    }) })),
            ((_b = options.jsonData.serviceMap) === null || _b === void 0 ? void 0 : _b.datasourceUid) ? (React.createElement(Button, { type: 'button', variant: 'secondary', size: 'sm', fill: 'text', onClick: () => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'serviceMap', {
                        datasourceUid: undefined,
                    });
                } }, "Clear")) : null)));
}
//# sourceMappingURL=ServiceGraphSettings.js.map