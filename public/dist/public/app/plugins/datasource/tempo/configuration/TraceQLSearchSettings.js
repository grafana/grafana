import { __awaiter } from "tslib";
import React from 'react';
import useAsync from 'react-use/lib/useAsync';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { getStyles } from './QuerySettings';
import { TraceQLSearchTags } from './TraceQLSearchTags';
export function TraceQLSearchSettings({ options, onOptionsChange }) {
    var _a;
    const styles = useStyles2(getStyles);
    const dataSourceSrv = getDataSourceSrv();
    const fetchDatasource = () => __awaiter(this, void 0, void 0, function* () {
        return (yield dataSourceSrv.get({ type: options.type, uid: options.uid }));
    });
    const { value: datasource } = useAsync(fetchDatasource, [dataSourceSrv, options]);
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "Removes the search tab from the query editor", label: "Hide search", labelWidth: 26 },
                React.createElement(InlineSwitch, { id: "hideSearch", value: (_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.hide, onChange: (event) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', Object.assign(Object.assign({}, options.jsonData.search), { hide: event.currentTarget.checked })) }))),
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "Configures which fields are available in the UI", label: "Static filters", labelWidth: 26 },
                React.createElement(TraceQLSearchTags, { datasource: datasource, options: options, onOptionsChange: onOptionsChange })))));
}
//# sourceMappingURL=TraceQLSearchSettings.js.map