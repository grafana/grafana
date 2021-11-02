import { DataSourceHttpSettings } from '@grafana/ui';
import { TraceToLogsSettings } from 'app/core/components/TraceToLogsSettings';
import React from 'react';
import { ServiceGraphSettings } from './ServiceGraphSettings';
import { config } from '@grafana/runtime';
import { SearchSettings } from './SearchSettings';
import { NodeGraphSettings } from 'app/core/components/NodeGraphSettings';
export var ConfigEditor = function (_a) {
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    return (React.createElement(React.Fragment, null,
        React.createElement(DataSourceHttpSettings, { defaultUrl: "http://tempo", dataSourceConfig: options, showAccessOptions: false, onChange: onOptionsChange }),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(TraceToLogsSettings, { options: options, onOptionsChange: onOptionsChange })),
        config.featureToggles.tempoServiceGraph && (React.createElement("div", { className: "gf-form-group" },
            React.createElement(ServiceGraphSettings, { options: options, onOptionsChange: onOptionsChange }))),
        config.featureToggles.tempoSearch && (React.createElement("div", { className: "gf-form-group" },
            React.createElement(SearchSettings, { options: options, onOptionsChange: onOptionsChange }))),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement(NodeGraphSettings, { options: options, onOptionsChange: onOptionsChange }))));
};
//# sourceMappingURL=ConfigEditor.js.map