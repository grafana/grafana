import React from 'react';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';
export function DataSourcePluginState({ state }) {
    return (React.createElement("div", { className: "gf-form" },
        React.createElement("div", { className: "gf-form-label width-10" }, "Plugin state"),
        React.createElement("div", { className: "gf-form-label gf-form-label--transparent" },
            React.createElement(PluginStateInfo, { state: state }))));
}
//# sourceMappingURL=DataSourcePluginState.js.map