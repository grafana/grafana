import { __assign } from "tslib";
import { DataSourceHttpSettings, InlineFormLabel, Select } from '@grafana/ui';
import React from 'react';
import { AlertManagerImplementation } from './types';
var IMPL_OPTIONS = [
    {
        value: AlertManagerImplementation.cortex,
        label: 'Cortex',
        description: "https://cortexmetrics.io/",
    },
    {
        value: AlertManagerImplementation.prometheus,
        label: 'Prometheus',
        description: 'https://prometheus.io/. Does not support editing configuration via API, so contact points and notification policies are read-only.',
    },
];
export var ConfigEditor = function (_a) {
    var options = _a.options, onOptionsChange = _a.onOptionsChange;
    return (React.createElement(React.Fragment, null,
        React.createElement("h3", { className: "page-heading" }, "Alertmanager"),
        React.createElement("div", { className: "gf-form-group" },
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement(InlineFormLabel, { width: 13 }, "Implementation"),
                    React.createElement(Select, { width: 40, options: IMPL_OPTIONS, value: options.jsonData.implementation || AlertManagerImplementation.cortex, onChange: function (value) {
                            return onOptionsChange(__assign(__assign({}, options), { jsonData: __assign(__assign({}, options.jsonData), { implementation: value.value }) }));
                        } })))),
        React.createElement(DataSourceHttpSettings, { defaultUrl: '', dataSourceConfig: options, showAccessOptions: true, onChange: onOptionsChange })));
};
//# sourceMappingURL=ConfigEditor.js.map