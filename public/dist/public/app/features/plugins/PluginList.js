import React from 'react';
import PluginListItem from './PluginListItem';
import { selectors } from '@grafana/e2e-selectors';
var PluginList = function (props) {
    var plugins = props.plugins;
    return (React.createElement("section", { className: "card-section card-list-layout-list" },
        React.createElement("ol", { className: "card-list", "aria-label": selectors.pages.PluginsList.list }, plugins.map(function (plugin, index) {
            return React.createElement(PluginListItem, { plugin: plugin, key: plugin.name + "-" + index });
        }))));
};
export default PluginList;
//# sourceMappingURL=PluginList.js.map