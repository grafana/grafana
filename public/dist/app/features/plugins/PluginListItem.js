import React from 'react';
var PluginListItem = function (props) {
    var plugin = props.plugin;
    return (React.createElement("li", { className: "card-item-wrapper" },
        React.createElement("a", { className: "card-item", href: "plugins/" + plugin.id + "/edit" },
            React.createElement("div", { className: "card-item-header" },
                React.createElement("div", { className: "card-item-type" },
                    React.createElement("i", { className: "icon-gf icon-gf-" + plugin.type }),
                    plugin.type),
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