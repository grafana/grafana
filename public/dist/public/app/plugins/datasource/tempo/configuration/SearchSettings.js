import React from 'react';
import { updateDatasourcePluginJsonDataOption } from '@grafana/data';
import { InlineField, InlineFieldRow, InlineSwitch, useStyles2 } from '@grafana/ui';
import { getStyles } from './QuerySettings';
export function SearchSettings({ options, onOptionsChange }) {
    var _a;
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { tooltip: "Removes the search tab from the query editor", label: "Hide search", labelWidth: 26 },
                React.createElement(InlineSwitch, { id: "hideSearch", value: (_a = options.jsonData.search) === null || _a === void 0 ? void 0 : _a.hide, onChange: (event) => updateDatasourcePluginJsonDataOption({ onOptionsChange, options }, 'search', Object.assign(Object.assign({}, options.jsonData.search), { hide: event.currentTarget.checked })) })))));
}
//# sourceMappingURL=SearchSettings.js.map