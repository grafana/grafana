import React from 'react';
import { updateDatasourcePluginJsonDataOption, } from '@grafana/data';
import { Button, InlineField, InlineFieldRow, useStyles2 } from '@grafana/ui';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';
import { getStyles } from './QuerySettings';
export function LokiSearchSettings({ options, onOptionsChange }) {
    var _a, _b, _c, _d;
    const styles = useStyles2(getStyles);
    // Default to the trace to logs datasource if configured and loki search was enabled
    // but only if jsonData.lokiSearch hasn't been set
    const legacyDatasource = ((_a = options.jsonData.tracesToLogs) === null || _a === void 0 ? void 0 : _a.lokiSearch) !== false ? (_b = options.jsonData.tracesToLogs) === null || _b === void 0 ? void 0 : _b.datasourceUid : undefined;
    if (legacyDatasource && options.jsonData.lokiSearch === undefined) {
        updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
            datasourceUid: legacyDatasource,
        });
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "The Loki data source with the service graph data", label: "Data source", labelWidth: 26 },
                React.createElement(DataSourcePicker, { inputId: "loki-search-data-source-picker", pluginId: "loki", current: (_c = options.jsonData.lokiSearch) === null || _c === void 0 ? void 0 : _c.datasourceUid, noDefault: true, width: 40, onChange: (ds) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
                        datasourceUid: ds.uid,
                    }) })),
            ((_d = options.jsonData.lokiSearch) === null || _d === void 0 ? void 0 : _d.datasourceUid) ? (React.createElement(Button, { type: 'button', variant: 'secondary', size: 'sm', fill: 'text', onClick: () => {
                    updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'lokiSearch', {
                        datasourceUid: undefined,
                    });
                } }, "Clear")) : null)));
}
//# sourceMappingURL=LokiSearchSettings.js.map