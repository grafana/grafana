/** Describes plugins life cycle status */
export var PluginState;
(function (PluginState) {
    PluginState["alpha"] = "alpha";
    PluginState["beta"] = "beta";
    PluginState["stable"] = "stable";
    PluginState["deprecated"] = "deprecated";
})(PluginState || (PluginState = {}));
/** Describes {@link https://grafana.com/docs/grafana/latest/plugins | type of plugin} */
export var PluginType;
(function (PluginType) {
    PluginType["panel"] = "panel";
    PluginType["datasource"] = "datasource";
    PluginType["app"] = "app";
    PluginType["renderer"] = "renderer";
})(PluginType || (PluginType = {}));
/** Describes status of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/ | plugin signature} */
export var PluginSignatureStatus;
(function (PluginSignatureStatus) {
    PluginSignatureStatus["internal"] = "internal";
    PluginSignatureStatus["valid"] = "valid";
    PluginSignatureStatus["invalid"] = "invalid";
    PluginSignatureStatus["modified"] = "modified";
    PluginSignatureStatus["missing"] = "missing";
})(PluginSignatureStatus || (PluginSignatureStatus = {}));
/** Describes level of {@link https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/#plugin-signature-levels/ | plugin signature level} */
export var PluginSignatureType;
(function (PluginSignatureType) {
    PluginSignatureType["grafana"] = "grafana";
    PluginSignatureType["commercial"] = "commercial";
    PluginSignatureType["community"] = "community";
    PluginSignatureType["private"] = "private";
    PluginSignatureType["core"] = "core";
})(PluginSignatureType || (PluginSignatureType = {}));
/** Describes error code returned from Grafana plugins API call */
export var PluginErrorCode;
(function (PluginErrorCode) {
    PluginErrorCode["missingSignature"] = "signatureMissing";
    PluginErrorCode["invalidSignature"] = "signatureInvalid";
    PluginErrorCode["modifiedSignature"] = "signatureModified";
})(PluginErrorCode || (PluginErrorCode = {}));
export var PluginIncludeType;
(function (PluginIncludeType) {
    PluginIncludeType["dashboard"] = "dashboard";
    PluginIncludeType["page"] = "page";
    // Only valid for apps
    PluginIncludeType["panel"] = "panel";
    PluginIncludeType["datasource"] = "datasource";
})(PluginIncludeType || (PluginIncludeType = {}));
var GrafanaPlugin = /** @class */ (function () {
    function GrafanaPlugin() {
        this.meta = {};
    }
    // Tabs on the plugin page
    GrafanaPlugin.prototype.addConfigPage = function (tab) {
        if (!this.configPages) {
            this.configPages = [];
        }
        this.configPages.push(tab);
        return this;
    };
    /**
     * Specify how the plugin should support paths within the live streaming environment
     */
    GrafanaPlugin.prototype.setChannelSupport = function (support) {
        this.channelSupport = support;
        return this;
    };
    return GrafanaPlugin;
}());
export { GrafanaPlugin };
//# sourceMappingURL=plugin.js.map