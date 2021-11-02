import React from 'react';
import { PluginSignatureBadge } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
var PluginListItem = function (props) {
    var plugin = props.plugin;
    return (React.createElement("li", { className: "card-item-wrapper", "aria-label": selectors.pages.PluginsList.listItem },
        React.createElement("a", { className: "card-item", href: "plugins/" + plugin.id + "/" },
            React.createElement("div", { className: "card-item-header" },
                React.createElement("div", { className: "card-item-type" }, plugin.type),
                React.createElement("div", { className: "card-item-badge" },
                    React.createElement(PluginSignatureBadge, { status: plugin.signature })),
                plugin.hasUpdate && (React.createElement("div", { className: "card-item-notice" },
                    React.createElement("span", { "bs-tooltip": "plugin.latestVersion" }, "Update available!")))),
            React.createElement("div", { className: "card-item-body" },
                React.createElement("figure", { className: "card-item-figure" },
                    React.createElement("img", { src: plugin.info.logos.small })),
                React.createElement("div", { className: "card-item-details" },
                    React.createElement("div", { className: "card-item-name" }, plugin.name),
                    React.createElement("div", { className: "card-item-sub-name" }, "By " + plugin.info.author.name))))));
};
export default PluginListItem;
//# sourceMappingURL=PluginListItem.js.map