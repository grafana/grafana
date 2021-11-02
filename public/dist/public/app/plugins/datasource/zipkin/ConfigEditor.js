import { DataSourceHttpSettings } from '@grafana/ui';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
export var ConfigEditor = function (_a) {
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://localhost:9411", dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange }),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(TraceToLogsSettings, { options: options, onOptionsChange: onOptionsChange })),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(NodeGraphSettings, { options: options, onOptionsChange: onOptionsChange }))));
};
//# sourceMappingURL=ConfigEditor.js.map